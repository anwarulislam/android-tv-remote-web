import "./App.css";
import { ConnectionScreen } from "./components/ConnectionScreen";
import { RemoteScreen } from "./components/RemoteScreen";
import { AndroidTVProvider, useAndroidTV } from "./hooks/useAndroidTV";

function AppContent() {
  const { deviceState } = useAndroidTV();

  const isConnectionScreen = [
    "disconnected",
    "pairing",
    "needs_pin",
    "discovering",
    "discovered",
    "select_saved",
    "no_server",
  ].includes(deviceState);

  return isConnectionScreen ? <ConnectionScreen /> : <RemoteScreen />;
}

function App() {
  return (
    <AndroidTVProvider>
      <AppContent />
    </AndroidTVProvider>
  );
}

export default App;
