# angular-with-openid-connect

Dieses Projekt bietet einen AngularJS-Service zur Nutzung von OpenId Connect mittels Implicit Flow. Die Nutzung wird anhand eines Beispiels demonstriert. 

Dabei sollte folgendes beachtet werden:
- Das Beispiel verwendet einen Test-Account bei Google für das Login. Dieser wird in absehbarer Zukunft entfernt, sodass zum Testen ein eigener Test-Account anzulegen ist.
- Beim Test-Account ist als RedirectUri die folgende Url registriert: http://localhost:3749/index.htm
  - Das Beispielprojekt sollte somit bei Nutzung des Test-Accounts unter dieser Url erreichbar sein
- Der Service validiert die folgenden Claims: iss, aud, nbf, exp
- Der Service validiert nicht die Signatur des Tokens. Dies wird den aufgerufenen Services überlassen.
- Zum Generieren von Nonces wendet sich der Service an eine zu konfigurierende Web-API
- Zum Testen finden sich die vom Beispiel konsumierten Services unter http://angular.at

Das Beispiel konfiguriert den Service in der Datei app.js:

```
app.run(function(oauthService, $http, $state, $rootScope, $location, voucherApiUrl, authUrl) {

    oauthService.rngUrl = voucherApiUrl + "/api/random";
    oauthService.loginUrl = authUrl;
    oauthService.redirectUri = location.origin + "/index.html";

    oauthService.clientId = "482348825399.apps.googleusercontent.com";
    oauthService.scope = "openid email";
    oauthService.issuer = "accounts.google.com";
    oauthService.oidc = true;
    
    [...]
});
```

# Beschreibung des Beispiels
Einen (Artikel mit einer Beschreibung zu diesem Beispiel)[http://www.heise.de/developer/artikel/Tipps-und-Tricks-fuer-AngularJS-Teil-3-OAuth-2-0-2620374.html] findet man (hier)[http://www.heise.de/developer/artikel/Tipps-und-Tricks-fuer-AngularJS-Teil-3-OAuth-2-0-2620374.html].
