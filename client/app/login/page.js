"use client"
import React, { useEffect, useState } from 'react'
import './login.css'
import { account } from '../appwrite/appwrite'
import { useRouter } from 'next/navigation';

function LoginPage() {
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      try {
        const user = await account.get();
        setLoggedInUser(user);
        router.push("/dashboard");
      } catch (error) {
        console.log("No user logged in");
      }
    };
    checkUser();
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await account.createEmailPasswordSession({
        email,
        password
      });
      setLoggedInUser(await account.get());
      router.push("/dashboard");
    } catch (error) {
      alert('Login failed: ' + error.message);
    }
  };

  return (
    <form className='login-container' onSubmit={handleSubmit}>
      <label className='logo-text'>Benvenuto</label>
      <label className='login-text'>Inserisci le credenziali per l'accesso</label>

      <input
        className="input-field"
        type='email'
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <input
        className="input-field"
        type='password'
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      <button className='button' type="submit">Login</button>

      <p className="footer-text">
        <label className='t2s-mini-logo'>AudioGen</label> Text-to-Speech
      </p>
    </form>
  );
}

export default LoginPage;
