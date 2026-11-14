import { StyleSheet, Text, View } from "react-native";

const features = [
  ["⌨", "Wireless Keyboard", "Type and use PC shortcuts from your phone."],
  ["🖱", "Wireless Mouse", "Use the screen as a touchpad: move, tap, right-click, drag and scroll."],
  ["🎙", "Voice Typing", "Speak, review and send text to Windows."],
  ["⇄", "File Transfer", "Send files to PC and browse approved shared files."],
  ["♫", "PC Audio", "Play PC audio through your phone speaker."]
];

export default function HomeScreen() {
  return <View style={styles.screen}>
    <View style={styles.header}>
      <View style={styles.logo}><Text style={styles.logoText}>MRK</Text></View>
      <View><Text style={styles.title}>MRK Connect</Text><Text style={styles.subtitle}>PC + Android companion</Text></View>
      <Text style={styles.badge}>V0.1</Text>
    </View>
    <View style={styles.hero}>
      <Text style={styles.eyebrow}>LOCAL-FIRST DEVICE LINK</Text>
      <Text style={styles.heading}>Your phone. Your PC. Connected.</Text>
      <Text style={styles.description}>Connect over the same Wi-Fi or phone hotspot. Core local features do not need internet.</Text>
    </View>
    {features.map(([icon, title, description]) => <View key={title} style={styles.card}>
      <Text style={styles.cardTitle}>{icon}  {title}</Text>
      <Text style={styles.cardText}>{description}</Text>
      <Text style={styles.planned}>IN DEVELOPMENT</Text>
    </View>)}
    <Text style={styles.footer}>Secure pairing · Hotspot + Wi-Fi</Text>
  </View>;
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:"#0b1210",paddingHorizontal:21,paddingTop:58},
  header:{flexDirection:"row",alignItems:"center",gap:12},
  logo:{width:45,height:45,borderRadius:13,backgroundColor:"#16865b",alignItems:"center",justifyContent:"center"},
  logoText:{color:"#fff",fontWeight:"900"},
  title:{color:"#eef5f1",fontSize:18,fontWeight:"800"},
  subtitle:{color:"#a9bbb2",fontSize:12,marginTop:3},
  badge:{marginLeft:"auto",color:"#9ce2bb",fontSize:10,borderWidth:1,borderColor:"#345548",padding:7,borderRadius:12},
  hero:{marginTop:48,marginBottom:22},
  eyebrow:{color:"#79d6a5",fontSize:10,fontWeight:"800",letterSpacing:2},
  heading:{color:"#eef5f1",fontSize:37,fontWeight:"900",lineHeight:43,marginTop:12},
  description:{color:"#a9bbb2",fontSize:14,lineHeight:22,marginTop:12},
  card:{backgroundColor:"#121f1a",borderColor:"#263b31",borderWidth:1,borderRadius:15,padding:16,marginBottom:10},
  cardTitle:{color:"#eef5f1",fontWeight:"800",fontSize:16},
  cardText:{color:"#a9bbb2",fontSize:12,lineHeight:18,marginTop:7},
  planned:{color:"#8ee0b0",fontSize:9,fontWeight:"800",marginTop:10,letterSpacing:1},
  footer:{color:"#82958b",fontSize:10,textAlign:"center",marginTop:12,marginBottom:20}
});
