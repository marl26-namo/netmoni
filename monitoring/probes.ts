import { spawn } from "node:child_process";
import dgram from "node:dgram";
import dns from "node:dns";
import net from "node:net";
import type { ProbeResult, ProbeTool } from "@/monitoring/types";

/**
 * Network fault-testing engine. Every probe returns a normalized ProbeResult
 * so the scheduler, alert engine, and UI can treat all tools uniformly:
 *
 *  - ping  : ICMP echo via the OS `ping` binary, TCP-connect fallback
 *  - snmp  : SNMP v2c GET (sysDescr.0, sysUpTime.0, ifNumber) over UDP 161
 *  - tcp   : connect/latency test against configured service ports
 *  - http  : GET with status-code and latency measurement
 *  - dns   : hostname resolution via the configured resolver
 *
 * Everything runs natively on the Node runtime — no external monitoring
 * agents — and each tool is independently switchable per scan.
 */

const PING_COUNT = 3;
const PING_TIMEOUT_MS = 2_000;
const SNMP_PORT = 161;
const SNMP_TIMEOUT_MS = 2_500;

/* ------------------------------- ping ---------------------------------- */

function parseLinuxPing(output: string) {
  const latency = output.match(/rtt min\/avg\/max\/(?:mdev|stddev) = [\d.]+\/([\d.]+)/);
  const loss = output.match(/([\d.]+)% packet loss/);
  const received = output.match(/(\d+) (?:packets )?received/);
  return {
    latencyMs: latency ? Number(latency[1]) : undefined,
    packetLossPct: loss ? Number(loss[1]) : undefined,
    replies: received ? Number(received[1]) : undefined,
  };
}

function parseWindowsPing(output: string) {
  const latency = output.match(/(?:Average = (\d+)ms|Minimum = \d+ms, Maximum = \d+ms, Average = (\d+)ms)/);
  const loss = output.match(/\((\d+)% loss\)/);
  return { latencyMs: latency ? Number(latency[1] ?? latency[2]) : undefined, packetLossPct: loss ? Number(loss[1]) : undefined, replies: undefined };
}

export function pingOnce(target: string, timeoutMs = PING_TIMEOUT_MS): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const isWindows = process.platform === "win32";
    const args = isWindows
      ? ["-n", "1", "-w", String(timeoutMs), target]
      : ["-c", "1", "-W", String(Math.max(1, Math.ceil(timeoutMs / 1000))), target];
    const child = spawn("ping", args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, timeoutMs + 1_500);
    child.stdout.on("data", (chunk) => { output += String(chunk); });
    child.stderr.on("data", (chunk) => { output += String(chunk); });
    child.on("error", () => {
      clearTimeout(timer);
      resolve({ tool: "ping", target, ok: false, detail: "ping binary unavailable on this host" });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const parsed = isWindows ? parseWindowsPing(output) : parseLinuxPing(output);
      const ok = code === 0;
      resolve({
        tool: "ping",
        target,
        ok,
        latencyMs: parsed.latencyMs,
        packetLossPct: parsed.packetLossPct ?? (ok ? 0 : 100),
        detail: ok
          ? `ICMP reply from ${target}${parsed.latencyMs !== undefined ? ` in ${parsed.latencyMs} ms` : ""}`
          : `No ICMP reply from ${target} (100% packet loss)`,
        data: { replies: parsed.replies, platform: process.platform },
      });
    });
  });
}

export async function pingProbe(target: string): Promise<ProbeResult> {
  const results: ProbeResult[] = [];
  for (let i = 0; i < PING_COUNT; i += 1) {
    results.push(await pingOnce(target));
    if (results[i].ok) break;
  }
  const good = results.find((r) => r.ok);
  if (good) return good;
  // ICMP replies can be filtered by hardened hosts. Before declaring the host
  // down we try an HTTP-level check: any HTTP response (< 500) proves the IP
  // stack is alive even when echo replies are suppressed. A raw TCP connect is
  // NOT enough evidence — transparent egress proxies accept every connection.
  const http = await httpProbe(`http://${target.includes(":") ? `[${target}]` : target}/`, 1_500);
  if (http.ok) {
    return { tool: "ping", target, ok: true, latencyMs: http.latencyMs, detail: `ICMP blocked; HTTP service answered (${http.detail})` };
  }
  return {
    tool: "ping",
    target,
    ok: false,
    packetLossPct: 100,
    latencyMs: undefined,
    detail: results[results.length - 1]?.detail ?? `Host ${target} unreachable`,
  };
}

/* ------------------------------- tcp ----------------------------------- */

export function tcpConnect(host: string, port: number, timeoutMs = 3_000): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = new net.Socket();
    let settled = false;
    const done = (result: ProbeResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done({
      tool: "tcp",
      target: `${host}:${port}`,
      ok: true,
      latencyMs: Date.now() - started,
      detail: `TCP ${port} open on ${host} (${Date.now() - started} ms)`,
    }));
    socket.once("timeout", () => done({ tool: "tcp", target: `${host}:${port}`, ok: false, detail: `TCP ${port} timed out after ${timeoutMs} ms` }));
    socket.once("error", (error: NodeJS.ErrnoException) => done({
      tool: "tcp",
      target: `${host}:${port}`,
      ok: false,
      detail: `TCP ${port} failed on ${host}: ${error.code ?? error.message}`,
    }));
    socket.connect(port, host);
  });
}

export async function tcpPortsProbe(host: string, ports: number[]): Promise<ProbeResult[]> {
  const targets = ports.length ? ports : [22, 80, 443];
  return Promise.all(targets.map((port) => tcpConnect(host, port)));
}

/* ------------------------------- http ---------------------------------- */

export async function httpProbe(url: string, timeoutMs = 5_000): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: "follow" });
    const latencyMs = Date.now() - started;
    const ok = response.status < 500;
    return {
      tool: "http",
      target: url,
      ok,
      latencyMs,
      detail: `HTTP ${response.status} in ${latencyMs} ms`,
      data: { status: response.status },
    };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      tool: "http",
      target: url,
      ok: false,
      latencyMs: Date.now() - started,
      detail: aborted ? `HTTP request timed out after ${timeoutMs} ms` : `HTTP request failed: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------- dns ---------------------------------- */

export function dnsProbe(hostname: string, server?: string): Promise<ProbeResult> {
  const started = Date.now();
  return new Promise((resolve) => {
    const resolver = new dns.Resolver();
    if (server) resolver.setServers([server]);
    const timer = setTimeout(() => {
      resolver.cancel();
      resolve({ tool: "dns", target: hostname, ok: false, detail: `DNS lookup for ${hostname} timed out` });
    }, 3_000);
    resolver.resolve4(hostname, (error, addresses) => {
      clearTimeout(timer);
      const latencyMs = Date.now() - started;
      if (error) {
        resolve({ tool: "dns", target: hostname, ok: false, latencyMs, detail: `DNS lookup failed for ${hostname}: ${error.code ?? error.message}` });
        return;
      }
      resolve({
        tool: "dns",
        target: hostname,
        ok: addresses.length > 0,
        latencyMs,
        detail: `DNS resolved ${hostname} → ${addresses[0]} in ${latencyMs} ms`,
        data: { addresses },
      });
    });
  });
}

/* ------------------------------- snmp ---------------------------------- */

/**
 * Minimal SNMP v2c client (BER/ASN.1 encoded, UDP 161). Supports GET of the
 * standard MIB-II system group OIDs that every managed device answers:
 *   1.3.6.1.2.1.1.1.0 sysDescr     — device description
 *   1.3.6.1.2.1.1.3.0 sysUpTime    — uptime in hundredths of a second
 *   1.3.6.1.2.1.1.5.0 sysName      — hostname
 */
export function snmpGet(host: string, community: string, oids: string[], timeoutMs = SNMP_TIMEOUT_MS): Promise<ProbeResult> {
  const encodeLength = (length: number): number[] => (length < 128 ? [length] : length < 256 ? [0x81, length] : [0x82, (length >> 8) & 0xff, length & 0xff]);
  type Payload = number | number[] | number[][];
  const flattenPayload = (payload: Payload): number[] => (typeof payload === "number" ? [payload] : payload.flatMap((item) => (typeof item === "number" ? [item] : flattenPayload(item))));
  const tlv = (tag: number, payload: Payload): number[] => [tag, ...encodeLength(flattenPayload(payload).length), ...flattenPayload(payload)];
  const encodeOid = (oid: string): number[] => {
    const parts = oid.split(".").map(Number);
    const body = [40 * parts[0] + parts[1], ...parts.slice(2).flatMap((part) => {
      if (part < 128) return [part];
      const bytes: number[] = [];
      let value = part;
      const stack: number[] = [];
      while (value > 0) { stack.unshift(value & 0x7f); value >>= 7; }
      stack.forEach((byte, index) => bytes.push(index === stack.length - 1 ? byte : byte | 0x80));
      return bytes;
    })];
    return tlv(0x06, body);
  };
  const encodeString = (value: string) => tlv(0x04, [...Buffer.from(value, "utf8")]);
  const encodeInt = (value: number) => {
    const bytes: number[] = [];
    let remaining = value;
    do { bytes.unshift(remaining & 0xff); remaining >>= 8; } while (remaining > 0);
    return tlv(0x02, bytes);
  };

  return new Promise((resolve) => {
    const varbindList = oids.flatMap((oid) => tlv(0x30, [encodeOid(oid), tlv(0x05, [])]));
    const pdu = tlv(0xa0, [encodeInt(Math.floor(Math.random() * 0x7fffffff)), encodeInt(0), tlv(0x30, varbindList)]);
    const message = tlv(0x30, [tlv(0x02, [0]), encodeString(community || "public"), pdu]);
    const packet = Buffer.from(message);

    const socket = dgram.createSocket("udp4");
    let settled = false;
    const finish = (result: ProbeResult) => {
      if (settled) return;
      settled = true;
      try { socket.close(); } catch { /* already closed */ }
      resolve(result);
    };

    const timer = setTimeout(() => finish({
      tool: "snmp",
      target: host,
      ok: false,
      detail: `SNMP timeout after ${timeoutMs} ms — agent unreachable or community "${community}" rejected`,
    }), timeoutMs);

    socket.on("message", (buffer: Buffer) => {
      clearTimeout(timer);
      try {
        const values = decodeSnmpResponse(buffer, oids);
        const uptimeTicks = values["1.3.6.1.2.1.1.3.0"];
        const uptime = typeof uptimeTicks === "number" ? Math.round(uptimeTicks / 100 / 60 / 60) : undefined;
        finish({
          tool: "snmp",
          target: host,
          ok: true,
          latencyMs: undefined,
          detail: `SNMP agent answered${uptime !== undefined ? ` — up ~${uptime} h` : ""}`,
          data: { values, sysName: values["1.3.6.1.2.1.1.5.0"], uptimeHours: uptime },
        });
      } catch (error) {
        finish({ tool: "snmp", target: host, ok: false, detail: `SNMP response could not be decoded: ${error instanceof Error ? error.message : "malformed"}` });
      }
    });
    socket.on("error", (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      finish({ tool: "snmp", target: host, ok: false, detail: `SNMP socket error: ${error.code ?? error.message}` });
    });

    socket.send(packet, SNMP_PORT, host, (error) => {
      if (error) {
        clearTimeout(timer);
        finish({ tool: "snmp", target: host, ok: false, detail: `SNMP send failed: ${error.message}` });
      }
    });
  });
}

/** Tiny BER decoder that walks the SNMP GetResponse PDU varbinds. */
function decodeSnmpResponse(buffer: Buffer, oids: string[]): Record<string, unknown> {
  let offset = 0;
  const readLength = () => {
    const first = buffer[offset++];
    if (first < 0x80) return first;
    const count = first & 0x7f;
    let length = 0;
    for (let i = 0; i < count; i += 1) length = length * 256 + buffer[offset++];
    return length;
  };
  const skip = (expectedTag: number) => {
    const tag = buffer[offset++];
    const length = readLength();
    if (tag !== expectedTag) throw new Error(`unexpected tag 0x${tag.toString(16)}`);
    const end = offset + length;
    return end;
  };
  skip(0x30); // message sequence
  offset += 1; // integer version
  const versionLength = buffer[offset - 1];
  if (versionLength > 1) offset += versionLength - 1;
  // community string
  if (buffer[offset] === 0x04) { offset += 1; offset += readLength(); }
  // GetResponse PDU
  const pduTag = buffer[offset];
  if (pduTag !== 0xa2) throw new Error(`expected GetResponse, got 0x${pduTag.toString(16)}`);
  offset += 1;
  readLength();
  offset += 2; // request-id
  offset += buffer[offset - 1] > 1 ? buffer[offset - 1] : 1; // error-status
  offset += 2; // error-index
  skip(0x30); // varbind list sequence
  const values: Record<string, unknown> = {};
  let index = 0;
  while (offset < buffer.length && index < oids.length) {
    const varbindEnd = skip(0x30);
    const oidTag = buffer[offset];
    if (oidTag !== 0x06) throw new Error("expected OID in varbind");
    offset += 1;
    const oidLength = readLength();
    const oidBytes = buffer.subarray(offset, offset + oidLength);
    let oid = `${Math.floor(oidBytes[0] / 40)}.${oidBytes[0] % 40}`;
    for (let i = 1; i < oidLength; i += 1) {
      let value = 0;
      while (oidBytes[i] & 0x80) { value = (value << 7) | (oidBytes[i] & 0x7f); i += 1; }
      value = (value << 7) | oidBytes[i];
      oid += `.${value}`;
    }
    offset += oidLength;
    const valueTag = buffer[offset];
    offset += 1;
    const valueLength = readLength();
    const raw = buffer.subarray(offset, offset + valueLength);
    let decoded: unknown;
    if (valueTag === 0x02 || valueTag === 0x43) decoded = raw.reduce((acc, byte) => acc * 256 + byte, 0);
    else if (valueTag === 0x04 || valueTag === 0x06) decoded = raw.toString("utf8");
    else decoded = raw.toString("hex");
    values[oid] = decoded;
    offset = varbindEnd;
    index += 1;
  }
  return values;
}

export async function snmpProbe(host: string, community: string): Promise<ProbeResult> {
  return snmpGet(host, community, ["1.3.6.1.2.1.1.1.0", "1.3.6.1.2.1.1.3.0", "1.3.6.1.2.1.1.5.0"]);
}

/* ------------------------------ unified -------------------------------- */

export type ProbeToolToggles = { ping?: boolean; snmp?: boolean; tcp?: boolean; http?: boolean; dns?: boolean };

export async function probeDevice(options: {
  ipAddress: string;
  httpUrls?: string;
  dnsHostname?: string;
  dnsServer?: string;
  tcpPorts: number[];
  snmpCommunity?: string;
  tools?: ProbeToolToggles;
}): Promise<ProbeResult[]> {
  const { ipAddress, httpUrls, dnsHostname, dnsServer, tcpPorts, snmpCommunity, tools } = options;
  const enabled = { ping: true, snmp: Boolean(snmpCommunity), tcp: tcpPorts.length > 0, http: Boolean(httpUrls), dns: Boolean(dnsHostname), ...tools };
  const jobs: Array<Promise<ProbeResult | ProbeResult[]>> = [];
  if (enabled.ping) jobs.push(pingProbe(ipAddress));
  if (enabled.snmp) jobs.push(snmpProbe(ipAddress, snmpCommunity!));
  if (enabled.tcp) jobs.push(tcpPortsProbe(ipAddress, tcpPorts));
  for (const url of (httpUrls ?? "").split(/[\s,]+/).filter(Boolean)) {
    jobs.push(httpProbe(url.startsWith("http") ? url : `http://${ipAddress}${url.startsWith("/") ? "" : "/"}${url}`));
  }
  if (enabled.dns && dnsHostname) jobs.push(dnsProbe(dnsHostname, dnsServer));
  const settled = await Promise.all(jobs.map((job) => job.catch(() => ({ tool: "ping" as ProbeTool, target: ipAddress, ok: false, detail: "probe crashed" }))));
  return settled.flat();
}
