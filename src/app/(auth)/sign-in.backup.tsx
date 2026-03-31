import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { useState } from "react";

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    console.log("Login clicked", email, password);

    // TEMP TEST (we'll connect real API later)
    if (email === "test" && password === "1234") {
      Alert.alert("Success", "Login successful");
    } else {
      Alert.alert("Error", "Invalid credentials");
    }
  };

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        padding: 24,
        backgroundColor: "white",
      }}
    >
      <Text style={{ color: "black", fontSize: 28, marginBottom: 24 }}>
        Sign In
      </Text>

	  <TextInput
	    placeholder="Email"
	    placeholderTextColor="#666"
	    value={email}
	    onChangeText={setEmail}
	    autoCapitalize="none"
	    autoCorrect={false}
	    style={{
	      borderWidth: 1,
	      borderColor: "#ccc",
	      padding: 12,
	      marginBottom: 12,
	      borderRadius: 8,
	      color: "black",
	      backgroundColor: "white",
	    }}
	  />

	  <TextInput
	    placeholder="Password"
	    placeholderTextColor="#666"
	    value={password}
	    onChangeText={setPassword}
	    secureTextEntry
	    autoCapitalize="none"
	    autoCorrect={false}
	    style={{
	      borderWidth: 1,
	      borderColor: "#ccc",
	      padding: 12,
	      marginBottom: 12,
	      borderRadius: 8,
	      color: "black",
	      backgroundColor: "white",
	    }}
	  />

      <TouchableOpacity
        onPress={handleLogin}
        style={{
          backgroundColor: "#0a84ff",
          padding: 14,
          borderRadius: 8,
          marginTop: 8,
        }}
      >
        <Text style={{ color: "white", textAlign: "center", fontSize: 16 }}>
          Sign In
        </Text>
      </TouchableOpacity>
    </View>
  );
}