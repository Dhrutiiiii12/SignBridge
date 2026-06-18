import { useState } from "react";
import { Toaster } from "sonner";
import { CameraPermission } from "../screens/CameraPermission";
import { HomeScreen } from "../screens/HomeScreen";
import { ActiveTranslationScreen } from "../screens/ActiveTranslationScreen";
import { ConversationScreen, Message } from "../screens/ConversationScreen";
import { ReplyModeScreen } from "../screens/ReplyModeScreen";
import { SettingsScreen } from "../screens/SettingsScreen";

type Screen = "permission" | "home" | "active" | "conversation" | "reply" | "settings";

export default function App() {
  const [screen, setScreen] = useState<Screen>("permission");
  const [cameraPermitted, setCameraPermitted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  const addMessage = (text: string, type: "signed" | "typed" = "signed") => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      text,
      type,
      time: new Date().toISOString(),
    }]);
  };

  return (
    <div style={{
      width: "100%",
      height: "100dvh",
      overflow: "hidden",
      position: "relative",
      maxWidth: 430,
      margin: "0 auto",
      background: "#FFFFFF",
    }}>
      <Toaster position="bottom-center" />

      {screen === "permission" && (
        <CameraPermission
          onGranted={() => { setCameraPermitted(true); setScreen("home"); }}
          onDenied={() => { setCameraPermitted(false); setScreen("home"); }}
        />
      )}

      {screen === "home" && (
        <HomeScreen
          cameraPermitted={cameraPermitted}
          onStart={() => setScreen("active")}
          onTypeInstead={() => setScreen("active")}
        />
      )}

      {screen === "active" && (
        <ActiveTranslationScreen
          cameraPermitted={cameraPermitted}
          onReply={() => setScreen("reply")}
          onSettings={() => setScreen("settings")}
          onConversation={() => setScreen("conversation")}
          addMessage={(text) => addMessage(text, "signed")}
        />
      )}

      {screen === "conversation" && (
        <ConversationScreen
          messages={messages}
          onBack={() => setScreen("active")}
          onSettings={() => setScreen("settings")}
          onReply={() => setScreen("reply")}
          onAddTyped={(text) => addMessage(text, "typed")}
        />
      )}

      {screen === "reply" && (
        <ReplyModeScreen
          onBack={() => setScreen("active")}
          onSend={(text) => { addMessage(text, "typed"); setScreen("conversation"); }}
        />
      )}

      {screen === "settings" && (
        <SettingsScreen onBack={() => setScreen("active")} />
      )}
    </div>
  );
}
