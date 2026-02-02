import { useState } from "react";
import api from "./api";
import Dashboard from "./Dashboard";


function App() {
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);

  const login = async () => {
    try {
      const res = await api.post("/auth/login", { pin });
      localStorage.setItem("token", res.data.token);
      setLoggedIn(true);
      setMsg("Login successful");
    } catch (err) {
      setMsg("Login failed");
    }
  };

  if (!loggedIn) {
    return (
      <div style={{ padding: 40 }}>
        <h2>POS Login</h2>
        <input
          placeholder="Enter PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
        />
        <br /><br />
        <button onClick={login}>Login</button>
        <p>{msg}</p>
      </div>
    );
  }

  return <Dashboard />;
}


export default App;
