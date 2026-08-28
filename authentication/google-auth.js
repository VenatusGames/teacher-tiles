(function setupGoogleAuth() {
  const container = document.getElementById('google-sign-in');
  if (!container) return;

  const clientId = window.TEACHERTILES_GOOGLE_CLIENT_ID || '';
  const status = document.createElement('span');
  status.className = 'google-sign-in__status';
  status.hidden = true;
  container.append(status);

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.hidden = !message;
    status.classList.toggle('is-error', isError);
  }

  function handleCredentialResponse(response) {
    if (!response?.credential) {
      setStatus('Google sign-in did not return a credential.', true);
      return;
    }

    window.dispatchEvent(new CustomEvent('teachertiles:google-sign-in', {
      detail: { credential: response.credential }
    }));
    setStatus('Google credential received.');
  }

  function initialize() {
    if (!clientId || clientId.startsWith('YOUR_')) {
      setStatus('Add a Google client ID to enable sign-in.', true);
      return;
    }
    if (!window.google?.accounts?.id) {
      setStatus('Google sign-in is still loading. Try again shortly.', true);
      return;
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredentialResponse,
      ux_mode: 'popup'
    });
    window.google.accounts.id.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      size: 'medium',
      text: 'signin_with',
      shape: 'rectangular',
      width: 190
    });
  }

  window.addEventListener('load', initialize, { once: true });
  if (window.google?.accounts?.id) initialize();
})();