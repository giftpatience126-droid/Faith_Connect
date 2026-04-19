import { useState } from "react";
import API from "../api";
import axios from "axios";

export default function Login() {
  const [form, setForm] = useState({
    email: "",
    password: ""
  });

  const handleChange = (e) => {
    setForm({...form, [e.target.name]: e.target.value});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await axios.post(`${API}/auth/login`, form);
      alert("Login success!");
      console.log(res.data);
    } catch (err) {
      console.log(err.response.data);
    }
  };

  return (
    <div>
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <input name="email" placeholder="Email" onChange={handleChange} />
        <input name="password" type="password" placeholder="Password" onChange={handleChange} />
        <button>Login</button>
      </form>
    </div>
  );
}