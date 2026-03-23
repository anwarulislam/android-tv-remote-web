import { Tv2, Wifi, WifiOff, Loader2, ChevronRight, RefreshCw, KeyRound, ServerOff } from 'lucide-react';

export interface Device {
    name: string;
    ip: string;
}

export interface ConnectionScreenProps {
    deviceState: string;
    tvName: string;
    discoveredDevices: Device[];
    savedDevices: Device[];
    ip: string;
    pin: string;
    setIp: (ip: string) => void;
    setPin: (pin: string) => void;
    connect: (ip: string, name: string) => void;
    discoverTV: () => void;
    submitPin: () => void;
    setDeviceState: (state: string) => void;
}

/* ── Helpers ───────────────────────────────────────────── */

function StateTitle({ deviceState, tvName }: { deviceState: string; tvName: string }) {
    if (deviceState === 'no_server') return <>Local Server Needed</>;
    if (deviceState === 'discovering') return <>Scanning Network&hellip;</>;
    if (deviceState === 'pairing') return <>Connecting to {tvName}&hellip;</>;
    if (deviceState === 'needs_pin') return <>Enter pairing code</>;
    if (deviceState === 'discovered') return <>Choose your TV</>;
    if (deviceState === 'select_saved') return <>Your devices</>;
    return <>Connect manually</>;
}

function StateSubtitle({ deviceState }: { deviceState: string }) {
    if (deviceState === 'no_server') return 'Your browser needs a bridge to talk to your TV';
    if (deviceState === 'discovering') return 'Looking for Android TV on your network';
    if (deviceState === 'pairing') return 'Establishing secure connection';
    if (deviceState === 'needs_pin') return 'Enter the 6-digit code shown on your TV screen';
    if (deviceState === 'discovered') return 'Select a device to begin';
    if (deviceState === 'select_saved') return 'Tap to reconnect instantly';
    return 'Type the IP address of your TV';
}

function DeviceList({
    devices,
    onConnect,
}: {
    devices: Device[];
    onConnect: (d: Device) => void;
}) {
    return (
        <div className="flex flex-col gap-3 w-full">
            {devices.map((d, i) => (
                <button
                    key={i}
                    className="device-btn flex items-center gap-4 text-left bg-white/5 border border-white/8 hover:bg-white/10 hover:border-white/20 p-4 rounded-2xl text-white cursor-pointer w-full animate-fade-in-up"
                    style={{ animationDelay: `${i * 60}ms` }}
                    onClick={() => onConnect(d)}
                >
                    <div className="shrink-0 w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
                        <Tv2 size={20} className="text-indigo-400" />
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                        <span className="font-semibold text-sm truncate">{d.name || 'Unknown TV'}</span>
                        <span className="text-white/40 text-xs mt-0.5 font-mono">{d.ip}</span>
                    </div>
                    <ChevronRight size={16} className="text-white/30 shrink-0" />
                </button>
            ))}
        </div>
    );
}

/* ── Main component ────────────────────────────────────── */

export function ConnectionScreen({
    deviceState,
    tvName,
    discoveredDevices,
    savedDevices,
    ip,
    pin,
    setIp,
    setPin,
    connect,
    discoverTV,
    submitPin,
    setDeviceState,
}: ConnectionScreenProps) {
    return (
        <div className="flex justify-center items-center w-full min-h-screen bg-zinc-950 p-4">

            {/* Ambient glow */}
            <div
                className="pointer-events-none absolute inset-0"
                style={{
                    background:
                        'radial-gradient(ellipse 60% 50% at 50% -10%, rgba(99,102,241,0.18) 0%, transparent 70%)',
                }}
            />

            <div className="relative z-10 w-full max-w-lg animate-fade-in-up">

                {/* Logo / brand */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-4">
                        <Tv2 size={26} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">Web Remote</h1>
                    <p className="text-white/40 text-sm mt-1 text-center">
                        <StateSubtitle deviceState={deviceState} />
                    </p>
                </div>

                {/* Card */}
                <div className="glass rounded-3xl p-7 shadow-2xl">
                    <h2 className="text-base font-semibold mb-5 text-center">
                        <StateTitle deviceState={deviceState} tvName={tvName} />
                    </h2>

                    <div className="flex flex-col items-center gap-4">

                        {/* ── No Server Found ── */}
                        {deviceState === 'no_server' && (
                            <div className="flex flex-col items-center gap-5 pb-2 text-center">
                                <ServerOff size={48} className="text-red-400/80 mb-2" />
                                <p className="text-white/70 text-sm">
                                    Browsers cannot directly connect to Android TVs over TLS. You need to run our lightweight local server on your computer first.
                                </p>

                                <div className="flex flex-col gap-3 w-full text-left mt-2">
                                    <div className="step-card">
                                        <div className="step-num">1</div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-white/90">Install & Run the Backend</p>
                                            <p className="text-xs text-white/50 mt-1 mb-2">Open your terminal and run this command (requires Node.js):</p>
                                            <code className="code-pill select-all">npx androidtv-remote-server</code>
                                        </div>
                                    </div>

                                    <div className="step-card">
                                        <div className="step-num">2</div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-white/90">Refresh this Page</p>
                                            <p className="text-xs text-white/50 mt-1">Once the server says it's listening, click below.</p>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-4 rounded-xl cursor-pointer transition-colors border-none text-sm flex items-center justify-center gap-2"
                                    onClick={discoverTV}
                                >
                                    <RefreshCw size={16} />
                                    I've started the server
                                </button>
                            </div>
                        )}

                        {/* ── Discovering ── */}
                        {deviceState === 'discovering' && (
                            <div className="flex flex-col items-center gap-5 py-6">
                                <div className="relative">
                                    <div className="w-16 h-16 rounded-full bg-indigo-500/15 flex items-center justify-center animate-ping-slow">
                                        <Wifi size={28} className="text-indigo-400" />
                                    </div>
                                    <div className="absolute inset-0 rounded-full border-2 border-indigo-500/30 animate-spin" />
                                </div>
                                <p className="text-white/40 text-sm">This may take a few seconds…</p>
                            </div>
                        )}

                        {/* ── Pairing / connecting ── */}
                        {deviceState === 'pairing' && (
                            <div className="flex flex-col items-center gap-5 py-6">
                                <Loader2 size={40} className="text-indigo-400 animate-spin" />
                                <p className="text-white/40 text-sm">Hold on while we connect securely</p>
                            </div>
                        )}

                        {/* ── Saved devices (multiple) ── */}
                        {deviceState === 'select_saved' && (
                            <div className="w-full">
                                <DeviceList
                                    devices={savedDevices}
                                    onConnect={(d) => connect(d.ip, d.name)}
                                />
                                <button
                                    className="flex items-center justify-center gap-2 w-full mt-1 py-3 rounded-xl text-sm font-medium text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors cursor-pointer"
                                    onClick={discoverTV}
                                >
                                    <RefreshCw size={14} />
                                    Scan for new devices
                                </button>
                            </div>
                        )}

                        {/* ── Discovered devices ── */}
                        {deviceState === 'discovered' && (
                            <div className="w-full">
                                <DeviceList
                                    devices={discoveredDevices}
                                    onConnect={(d) => connect(d.ip, d.name)}
                                />
                                <div className="flex gap-3 w-full mt-1">
                                    <button
                                        className="flex-1 py-3 rounded-xl text-sm font-medium text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors cursor-pointer"
                                        onClick={() => setDeviceState('disconnected')}
                                    >
                                        Manual IP
                                    </button>
                                    <button
                                        className="flex items-center justify-center gap-2 flex-1 py-3 rounded-xl text-sm font-medium text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer border border-indigo-500/25"
                                        onClick={discoverTV}
                                    >
                                        <RefreshCw size={14} />
                                        Rescan
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── Manual IP ── */}
                        {deviceState === 'disconnected' && (
                            <div className="flex flex-col gap-4 w-full">
                                <div className="flex items-center gap-3 bg-zinc-950/60 border border-white/10 rounded-xl px-4 focus-within:border-indigo-500/60 transition-colors">
                                    <WifiOff size={16} className="text-white/30 shrink-0" />
                                    <input
                                        type="text"
                                        placeholder="192.168.x.x"
                                        value={ip}
                                        onChange={(e) => setIp(e.target.value)}
                                        className="w-full py-4 bg-transparent text-white text-sm placeholder-white/25 outline-none font-mono tracking-wider"
                                    />
                                </div>
                                <div className="flex gap-3 w-full">
                                    <button
                                        className="flex-[2] bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3.5 rounded-xl cursor-pointer transition-colors border-none text-sm"
                                        onClick={() => connect(ip, 'Android TV')}
                                    >
                                        Connect
                                    </button>
                                    <button
                                        className="flex items-center justify-center gap-1.5 flex-[1] bg-transparent border border-white/15 text-white/60 hover:text-white hover:bg-white/5 font-semibold py-3.5 rounded-xl cursor-pointer transition-colors text-sm"
                                        onClick={discoverTV}
                                    >
                                        <RefreshCw size={13} />
                                        Scan
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── PIN entry ── */}
                        {deviceState === 'needs_pin' && (
                            <div className="flex flex-col gap-4 w-full">
                                <div className="flex items-center justify-center gap-3 bg-zinc-950/60 border border-white/10 rounded-xl px-4 focus-within:border-indigo-500/60 transition-colors">
                                    <KeyRound size={16} className="text-white/30 shrink-0" />
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="000000"
                                        value={pin}
                                        onChange={(e) => setPin(e.target.value)}
                                        maxLength={6}
                                        className="w-full py-4 bg-transparent text-white text-center text-2xl tracking-[0.35em] font-bold placeholder-white/15 outline-none"
                                    />
                                </div>
                                <button
                                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-4 rounded-xl cursor-pointer transition-colors border-none text-sm"
                                    onClick={submitPin}
                                >
                                    Pair Device
                                </button>
                                <p className="text-center text-white/30 text-xs">
                                    The pairing code is shown on your TV screen
                                </p>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
}
