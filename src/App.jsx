import { useState } from 'react'
import ViewerPage from './components/ViewerPage'
import AdminPage from './components/AdminPage'

function App() {
  const [isAdmin, setIsAdmin] = useState(false)

  const toggleAdmin = () => {
    if (!isAdmin) {
      const password = prompt("Entrez le mot de passe Admin :");
      if (password === "Azert.y10200211") {
        setIsAdmin(true);
      } else {
        alert("Accès refusé !");
      }
    } else {
      setIsAdmin(false);
    }
  }

  // On construit l'URL de l'image de manière dynamique pour GitHub Pages
  const backgroundUrl = `${import.meta.env.BASE_URL}background.jpg`;

  return (
    <div 
      className="h-screen w-screen m-0 p-0 overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url('${backgroundUrl}')` }}
    >
      <div className="h-full w-full bg-black/50 backdrop-blur-[2px] relative m-0 p-0">
        
        {/* BOUTON ADMIN : DÉPLACÉ EN BAS À DROITE ET RENDU TRANSPARENT */}
        <button 
          onClick={toggleAdmin} 
          className="fixed bottom-2 right-2 z-[9999] opacity-0 hover:opacity-40 transition-opacity text-[10px] text-white font-mono px-2 py-1 rounded cursor-pointer"
        >
          {isAdmin ? '[ EXIT ]' : '[ ADMIN ]'}
        </button>

        <main className="h-full w-full m-0 p-0 flex items-center justify-center">
          {isAdmin ? <AdminPage /> : <ViewerPage />}
        </main>
      </div>
    </div>
  )
}

export default App