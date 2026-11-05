import React, { useState } from 'react'
import "./navbar.css"
import { LuAudioWaveform } from "react-icons/lu";
import { account } from '@/app/appwrite/appwrite';
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRightFromBracket } from '@fortawesome/free-solid-svg-icons/faArrowRightFromBracket';
import { faPlay } from '@fortawesome/free-solid-svg-icons/faPlay';
import { faBolt } from '@fortawesome/free-solid-svg-icons/faBolt';
function Navbar({ page, onSynthesize, canSynthesize = true }) {

  const router = useRouter();

  const [loggedInUser, setLoggedInUser] = useState(true); // o il tuo stato reale

  async function logout() {
    try {
      await account.deleteSession({ sessionId: "current" });
      setLoggedInUser(null);
      router.push("/login"); // opzionale: redirect al login dopo logout
    } catch (error) {
      console.error("Errore durante il logout:", error);
    }
  }


  return (
    <nav className="navbar">
      <ul>
        <li className="nav-logo"><LuAudioWaveform className="nav-mini-logo" /><label className='nav-logo-text'>AudioGen</label></li>
        <ul className="nav-middle">
        </ul>
        <li className="buttons-conteiner">
          <button
            type="button"
            className='sintetizza-button'
            onClick={onSynthesize}
            disabled={!canSynthesize}
            aria-label="Sintetizza audio"
          >
            <FontAwesomeIcon icon={faBolt} />
            <span className="text">Sintetizza</span>
          </button>
          <hr className='button-separator'></hr>
          <button type="button" className="logout-button" onClick={logout}>
            <FontAwesomeIcon icon={faArrowRightFromBracket} />
            <span className="text">Logout</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}

export default Navbar