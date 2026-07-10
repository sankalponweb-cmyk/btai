import { createContext, useContext, useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged } from './firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,            setUser]            = useState(null)
  const [credits,         setCredits]         = useState(null)
  const [creditsOverride, setCreditsOverride] = useState(null)
  const [loading,         setLoading]         = useState(true)

  // Track Firebase auth state — call /api/me on sign-in to:
  //   1. Ensure the Firestore user doc (with 3 free credits) is created for new users
  //   2. Detect test users (credits === 999) and set an override so Firestore snapshot
  //      doesn't overwrite the sentinel value with the real stored value
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (!firebaseUser) {
        setCredits(null)
        setCreditsOverride(null)
        setLoading(false)
        return
      }
      try {
        const token = await firebaseUser.getIdToken()
        const res = await fetch('/api/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          if (data.credits === 999) setCreditsOverride(999)
        }
      } catch {
        // non-fatal — Firestore snapshot will still update credits when doc exists
      }
    })
    return unsub
  }, [])

  // Real-time Firestore credit balance — updates instantly on any device (e.g. after payment)
  useEffect(() => {
    if (!user) return
    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          setCredits(snap.data().credits ?? 0)
        }
        setLoading(false)
      },
      () => setLoading(false),
    )
    return unsub
  }, [user])

  const signInWithGoogle = () => signInWithPopup(auth, googleProvider)
  const signOutUser      = () => signOut(auth)
  const getIdToken       = () => (user ? user.getIdToken() : Promise.resolve(null))

  return (
    <AuthContext.Provider value={{ user, credits: creditsOverride ?? credits, loading, signInWithGoogle, signOutUser, getIdToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
