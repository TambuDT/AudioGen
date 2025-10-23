"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { account } from "../appwrite/appwrite";

export default function PrivateRoute({ children }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      try {
        await account.get(); // utente loggato
        setLoading(false);
      } catch (error) {
        router.push("/login"); // utente non loggato torna sempre alla login, le altre pagine non sono accessibili
      }
    };

    checkUser();
  }, [router]);

  if (loading) return <div>Loading...</div>;

  return <>{children}</>;
}
