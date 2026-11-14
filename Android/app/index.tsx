import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

type PairResult = { type: "pairResult"; accepted: boolean; sessionToken?: string };
const DEFAULT_PORT = "47831";

export default function HomeScreen() {
  const [address, setAddress] = useState("");
  const [port, setPort] = useState(DEFAULT_PORT);
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState("Not connected");
  const [error, setError] = useState("");
  const [paired, setPaired] = useState(false);
  const socket = useRef<WebSocket | null>(null);
  const token = useRef<string | null>(null);

  useEffect(() => () => { socket.current?.close(); }, []);

  const connect = () => {
    setError("");
    setPaired(false);
    token.current = null;
    socket.current?.close();
    const host = address.trim();
    const cleanPort = port.trim();
    if (!host || !/^\d{1,5}$/.test(cleanPort) || Number(cleanPort) < 1 || Number(cleanPort) > 65535 || !/^\d{6}$/.test(pin)) {
      setError("PC IP, valid port aur 6-digit PIN enter karein.");
      return;
    }
    setStatus("Connecting…");
    const ws = new WebSocket(`ws://${host}:${cleanPort}`);
    socket.current = ws;
    ws.onopen = () => {
      setStatus("Sending pairing request…");
      ws.send(JSON.stringify({ type: "pairRequest", pairingCode: pin }));
    };
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as PairResult;
        if (message.type === "pairResult" && message.accepted && message.sessionToken) {
          token.current = message.sessionToken;
          setPaired(true);
          setStatus("Connected to Windows PC");
          setError("");
        } else if (message.type === "pairResult") {
          setStatus("Pairing rejected");
          setError("PIN galat hai. Windows par dikhaya gaya naya PIN check karein.");
        }
      } catch {
        setError("PC se invalid response mila.");
      }
    };
    ws.onerror = () => { setStatus("Connection failed"); setError("PC IP, port aur same Wi-Fi/hotspot connection check karein."); };
    ws.onclose = () => { setPaired(false); token.current = null; setStatus("Disconnected"); };
  };

  const disconnect = () => {
    socket.current?.close();
    socket.current = null;
    token.current = null;
    setPaired(false);
    setStatus("Disconnected");
  };

  const sendPing = () => {
    if (socket.current?.readyState === WebSocket.OPEN && token.current) {
      socket.current.send(JSON.stringify({ type: "ping", sessionToken: token.current }));
      setStatus("Connected · test ping sent");
    }
  };

  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <View style={styles.header}>
      <View style={styles.logo}><Text style={styles.logoText}>MRK</Text></View>
      <View><Text style={styles.title}>MRK Connect</Text><Text style={styles.subtitle}>Android companion for Windows</Text></View>
      <Text style={styles.badge}>V0.1</Text>
    </View>

    <View style={styles.hero}>
      <Text style={styles.eyebrow}>LOCAL NETWORK CONNECTION</Text>
      <Text style={styles.heading}>Connect your phone to your PC.</Text>
      <Text style={styles.description}>Dono devices ko same Wi-Fi ya phone hotspot par rakhein. Internet ki zaroorat nahi.</Text>
    </View>

    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>Pair Windows PC</Text>
      <Text style={styles.label}>PC IPv4 address</Text>
      <TextInput value={address} onChangeText={setAddress} placeholder="Example: 192.168.43.120" placeholderTextColor="#71857a" autoCapitalize="none" keyboardType="decimal-pad" style={styles.input}/>
      <View style={styles.row}>
        <View style={styles.portBox}><Text style={styles.label}>Port</Text><TextInput value={port} onChangeText={setPort} keyboardType="number-pad" style={styles.input}/></View>
        <View style={styles.pinBox}><Text style={styles.label}>6-digit Windows PIN</Text><TextInput value={pin} onChangeText={v => setPin(v.replace(/\D/g, "").slice(0,6))} keyboardType="number-pad" maxLength={6} secureTextEntry style={styles.input}/></View>
      </View>
      <View style={styles.statusRow}><View style={[styles.dot,{backgroundColor:paired ? "#65d99a" : "#d6a64b"}]}/><Text style={styles.status}>{status}</Text></View>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Pressable onPress={paired ? disconnect : connect} style={styles.primary}><Text style={styles.primaryText}>{paired ? "Disconnect" : "Connect & Pair"}</Text></Pressable>
      {paired && <Pressable onPress={sendPing} style={styles.secondary}><Text style={styles.secondaryText}>Test connection</Text></Pressable>}
    </View>

    <View style={styles.features}>
      <Text style={styles.sectionTitle}>Coming after pairing</Text>
      {["Wireless mouse & touchpad","Wireless keyboard & shortcuts","Voice typing with preview","Restricted two-way file transfer","PC audio on phone speaker"].map(item =>
        <View key={item} style={styles.feature}><Text style={styles.featureMark}>•</Text><Text style={styles.featureText}>{item}</Text></View>
      )}
    </View>
    <Text style={styles.footer}>Pair only with a PC you trust. Local network connection.</Text>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:"#0b1210",paddingHorizontal:21,paddingTop:58},
  header:{flexDirection:"row",alignItems:"center",gap:12},
  logo:{width:45,height:45,borderRadius:13,backgroundColor:"#16865b",alignItems:"center",justifyContent:"center"},
  logoText:{color:"#fff",fontWeight:"900"}, title:{color:"#eef5f1",fontSize:18,fontWeight:"800"},
  subtitle:{color:"#a9bbb2",fontSize:12,marginTop:3},
  badge:{marginLeft:"auto",color:"#9ce2bb",fontSize:10,borderWidth:1,borderColor:"#345548",padding:7,borderRadius:12},
  hero:{marginTop:34,marginBottom:20},eyebrow:{color:"#79d6a5",fontSize:10,fontWeight:"800",letterSpacing:2},
  heading:{color:"#eef5f1",fontSize:31,fontWeight:"900",lineHeight:37,marginTop:10},
  description:{color:"#a9bbb2",fontSize:13,lineHeight:20,marginTop:9},
  panel:{backgroundColor:"#121f1a",borderColor:"#2c493b",borderWidth:1,borderRadius:16,padding:16},
  sectionTitle:{color:"#eef5f1",fontWeight:"800",fontSize:16,marginBottom:13},
  label:{color:"#9fb5a8",fontSize:11,fontWeight:"700",marginBottom:6},
  input:{backgroundColor:"#0b1510",borderColor:"#345344",borderWidth:1,borderRadius:9,color:"#f1f7f3",paddingHorizontal:12,paddingVertical:11,fontSize:14},
  row:{flexDirection:"row",gap:10,marginTop:12},portBox:{width:104},pinBox:{flex:1},
  statusRow:{flexDirection:"row",alignItems:"center",gap:8,marginTop:15},
  dot:{width:8,height:8,borderRadius:4},status:{color:"#d5e4db",fontSize:12},
  error:{color:"#ff9b91",fontSize:12,marginTop:8,lineHeight:17},
  primary:{backgroundColor:"#16865b",borderRadius:10,alignItems:"center",padding:14,marginTop:15},
  primaryText:{color:"#fff",fontWeight:"800",fontSize:14},
  secondary:{borderColor:"#47735c",borderWidth:1,borderRadius:10,alignItems:"center",padding:11,marginTop:9},
  secondaryText:{color:"#a8e8c0",fontWeight:"700"},
  features:{marginTop:22},feature:{flexDirection:"row",gap:9,marginBottom:9},
  featureMark:{color:"#79d6a5",fontSize:17},featureText:{color:"#c1d1c8",fontSize:12},
  footer:{color:"#82958b",fontSize:10,textAlign:"center",marginTop:15,marginBottom:20}
});
