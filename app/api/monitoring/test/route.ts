import { NextResponse } from "next/server";
import { probeDevice } from "@/monitoring/probes";
import { monitoringStore } from "@/monitoring/store";

/**
 * POST /api/monitoring/test — run the network tool suite against one device
 * (or a raw host) and return every probe result. Used by the "Test device"
 * buttons in the Devices and Overview screens.
 *
 * Body: { organizationId, deviceId?, host?, tools?: { ping, snmp, tcp, http, dns } }
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      organizationId?: string;
      deviceId?: string;
      host?: string;
      tools?: { ping?: boolean; snmp?: boolean; tcp?: boolean; http?: boolean; dns?: boolean };
    };
    const organizationId = body.organizationId ?? "local-workspace";
    const settings = await monitoringStore.getSettings(organizationId);

    let host = body.host?.trim();
    let httpUrls = settings.httpUrls;
    let dnsHostname = settings.dnsHostname;
    let dnsServer = settings.dnsServer;
    if (body.deviceId) {
      const device = await monitoringStore.getDevice(organizationId, body.deviceId);
      if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 });
      host = host ?? device.ipAddress;
    }
    if (!host) return NextResponse.json({ error: "Provide a deviceId or host to test" }, { status: 400 });

    const tcpPorts = settings.tcpPorts.split(/[\s,]+/).filter(Boolean).map(Number).filter((p) => Number.isFinite(p) && p > 0);
    const probes = await probeDevice({
      ipAddress: host,
      httpUrls,
      dnsHostname,
      dnsServer,
      tcpPorts: settings.tcpPortsEnabled ? tcpPorts : [],
      snmpCommunity: settings.snmpCommunity || undefined,
      tools: body.tools,
    });
    const ok = probes.some((probe) => probe.ok);
    return NextResponse.json({
      host,
      ok,
      latencyMs: probes.find((p) => p.ok && p.latencyMs !== undefined)?.latencyMs,
      probes,
      testedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Device test failed" }, { status: 500 });
  }
}
