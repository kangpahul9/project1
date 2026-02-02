import { useEffect, useState } from "react";
import axios from "axios";

function Dashboard() {
  const [cashStatus, setCashStatus] = useState(null);
  const [denoms, setDenoms] = useState({
  500: 0,
  200: 0,
  100: 0,
  50: 0,
  20: 0,
  10: 0,
});

const updateDenom = (value, count) => {
  setDenoms((prev) => ({
    ...prev,
    [value]: Number(count),
  }));
};

  const loadCashStatus = async () => {
    try {
      const res = await axios.get("/api/cash/status", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      setCashStatus(res.data);
    } catch (err) {
      alert("Failed to load cash status");
    }
  };

  const startDay = async () => {
  try {
    const payload = {
      date: new Date().toISOString().slice(0, 10),
      denoms: Object.entries(denoms).map(([value, count]) => ({
        value: Number(value),
        count,
      })),
    };
    

    await axios.post("/api/cash/start", payload, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    alert("Day started successfully");
    loadCashStatus();
  } catch (err) {
    alert("Failed to start day");
  }
};

const closeDay = async () => {
  try {
    await axios.post("/api/cash/close", {}, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    alert("Day closed successfully");
    loadCashStatus();
  } catch (err) {
    alert("Failed to close day");
  }
};


  useEffect(() => {
    loadCashStatus();
  }, []);

  return (
    <div>
      <h2>Dashboard</h2>

      {!cashStatus?.date && <p>No business day started yet</p>}

      {cashStatus?.date && (
        <div>
          <p>Date: {cashStatus.date}</p>
          <p>Opening: ₹{cashStatus.opening}</p>
          <p>Closing: ₹{cashStatus.closing}</p>
          <p>Status: {cashStatus.closed ? "Closed" : "Open"}</p>
        </div>
      )}
      {cashStatus?.closed && (
  <div style={{ marginTop: 20 }}>
    <h3>Start New Day</h3>

    {[500, 200, 100, 50, 20, 10].map((v) => (
      <div key={v}>
        ₹{v} :
        <input
          type="number"
          min="0"
          value={denoms[v]}
          onChange={(e) => updateDenom(v, e.target.value)}
          style={{ marginLeft: 10 }}
        />
      </div>
    ))}

    <br />
    <button onClick={startDay}>Start Day</button>
  </div>
)}

{cashStatus?.date && !cashStatus.closed && (
  <div style={{ marginTop: 20 }}>
    <button onClick={closeDay}>Close Day</button>
  </div>
)}

    </div>
  );
}

export default Dashboard;
