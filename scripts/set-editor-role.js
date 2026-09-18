/**
 * Set current user's role to "editor"
 *
 * Run in browser console while logged into NoteSheet (localhost:5173)
 *
 * OBSOLETO: desde que firestore.rules está desplegado, este script ya no
 * funciona — y ese es justamente el punto. Las reglas impiden que un usuario
 * modifique su propio campo `role`, que es el agujero que este script
 * demostraba. Para asignar un rol, usa la consola de Firebase
 * (Firestore > users > {uid} > role) o el Admin SDK desde un entorno de
 * confianza. Se conserva como referencia de la vulnerabilidad corregida.
 */
(async () => {
  const keys = Object.keys(localStorage);
  const authKey = keys.find(k => k.includes('firebase:authUser'));
  if (!authKey) { console.error('❌ Not logged in'); return; }

  const authData = JSON.parse(localStorage.getItem(authKey));
  const { uid, email } = authData;
  const token = authData.stsTokenManager.accessToken;
  const projectId = authKey.match(/\[([^\]]+)\]/)?.[1];

  console.log(`Setting editor role for: ${email}`);

  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=role&updateMask.fieldPaths=id`,
    {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          id: { stringValue: uid },
          role: { stringValue: 'editor' }
        }
      })
    }
  );

  console.log(res.ok ? '✅ Done! Refresh the page.' : '❌ Error: ' + (await res.text()));
})();
