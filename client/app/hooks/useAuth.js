"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { account } from "../appwrite/appwrite";

// Hook per controllare se l'utente è loggato
export const useAuth = (redirectIfLoggedIn = false) => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      try {
        await account.get(); // prova a ottenere l'utente
        if (redirectIfLoggedIn) {
          router.push("/"); // se è loggato ma deve stare fuori dal login, redirect
        } else {
          setLoading(false); // utente loggato e può restare nella pagina
        }
      } catch (error) {
        if (!redirectIfLoggedIn) {
          router.push("/login"); // utente non loggato, redirect a login
        } else {
          setLoading(false); // utente non loggato e può restare nella pagina login
        }
      }
    };

    checkUser();
  }, [router, redirectIfLoggedIn]);

  return loading;
};
