var oauth2 = oauth2 || {};

(function (namespace) {

    function OAuthService($document, $window, $timeout, $q, $location, $http, $base64, $log) {

        this.clientId = "";
        this.redirectUri = "";
        this.loginUrl = "";
        this.scope = "";
        this.rngUrl = "";
        this.oidc = false;

        this.createLoginUrl = function (state) {
            var that = this;

            if (typeof state === "undefined") { state = ""; }

            return this.createAndSaveNonce().then(function (nonce) {

                if (state) {
                    state = nonce + ";" + state;
                }
                else {
                    state = nonce;   
                }

                var response_type = "token";

                if (that.oidc) {
                    response_type = "id_token";
                }

                var url = that.loginUrl 
                            + "?response_type="
                            + response_type
                            + "&client_id=" 
                            + encodeURIComponent(that.clientId) 
                            + "&state=" 
                            + encodeURIComponent(state) 
                            + "&redirect_uri=" 
                            + encodeURIComponent(that.redirectUri) 
                            + "&scope=" 
                            + encodeURIComponent(that.scope);
                
                if (that.oidc) {
                    url += "&nonce=" + nonce;
                }

                return url;
            });
        };

        this.initImplicitFlow = function (additionalState) {
            this.createLoginUrl(additionalState).then(function (url) {
                location.href = url;
            })
            .catch(function (error) {
                $log.error("Error in initImplicitFlow");
                $log.error(error);
            });
        };

        var padBase64 = function (base64data) {
            while (base64data.length % 4 !== 0) {
                base64data += "=";
            }
            return base64data;
        }

        this.getClaims = function() {
            var claims = localStorage.getItem("claimsJson");
            if (!claims) return null;
            return JSON.parse(claims);
        }

        this.tryLogin = function () {
            
            var parts = this.getFragment();

            var accessToken = parts["access_token"];
            var idToken = parts["id_token"];

            var gotToken = !!accessToken || !!idToken;

            var state = parts["state"];

            if (!gotToken || !state)
                return false;

            var savedNonce = localStorage.getItem("nonce");

            var stateParts = state.split(';');

            if (savedNonce !== stateParts[0])  return;

            if (this.oidc) {
                
                var tokenParts = idToken.split(".");
                var claimsBase64 = padBase64(tokenParts[1]);
                var claimsJson = $base64.decode(claimsBase64);
                var claims = JSON.parse(claimsJson);
                
                if (claims.aud !== this.clientId) {
                    $log.warn("Wrong audience: " + claims.aud);
                    return false;
                }

                if (this.issuer && claims.iss !== this.issuer) {
                    $log.warn("Wrong issuer: " + claims.issuer);
                    return false;
                }

                if (claims.nonce !== savedNonce) {
                    $log.warn("Wrong nonce: " + claims.nonce);
                    return false;
                }
                
                // Das Prüfen des Zertifikates wird der Serverseite überlassen!

                var now = Date.now();
                var issuedAtMSec = claims.iat * 1000;
                var expiresAtMSec = claims.exp * 1000;

                if (issuedAtMSec > now || expiresAtMSec < now) {
                    $log.warn("Token has been expired");
                    return false;
                }

                localStorage.setItem("id_token", idToken);
                localStorage.setItem("claimsJson", claimsJson);
                localStorage.setItem("expires_at", expiresAtMSec);
            }
            else {
                localStorage.setItem("access_token", accessToken);

                var expiresIn = parts["expires_in"];

                if (expiresIn) {
                    expiresInMilliSeconds = parseInt(expiresIn) * 1000;
                    var now = new Date();
                    var expiresAt = now.getTime() + expiresInMilliSeconds;
                    localStorage.setItem("expires_at", expiresAt);
                }
            }

            if (stateParts.length > 1) {
                this.state = stateParts[1];
            }

            var win = window;
            if (win.parent && win.parent.onOAuthCallback) {
                win.parent.onOAuthCallback(this.state);
            }

            return true;
            

        };

        this.tryLoginWithIFrame = function () {
            var that = this;
            var deferred = $q.defer();

            var url = this.createLoginUrl();

            var html = "<iframe src='" + url + "' height='400' width='400' id='oauthFrame' class='oauthFrame'></iframe>";
            var win = window;

            win.onOAuthCallback = function () {
                $timeout(function () {
                    $document.find("#oauthFrame").remove();
                }, 0);

                deferred.resolve();
            };

            $document.find("#oauthFrame").remove();

            var elem = $(html);
            $document.find("body").children().first().append(elem);

            return deferred.promise;
        };

        this.tryRefresh = function () {
            var that = this;
            var deferred = $q.defer();

            return this.createLoginUrl().then(function (url) {

                var html = "<iframe src='" + url + "' height='400' width='400' id='oauthFrame' class='oauthFrameHidden'></iframe>";

                var win = window;
                var callbackExecuted = false;
                var timeoutReached = false;

                // Wenn nach einer festgelegten Zeitspanne keine Antwort kommt: Timeout
                var timeoutPromise = $timeout(function () {
                    if (!callbackExecuted) {
                        timeoutReached = true;
                        var x = $document.find("iframe");

                        $document.find("#oauthFrame").remove();
                        deferred.reject();
                    }
                }, 10000);

                win.onOAuthCallback = function () {
                    if (timeoutReached)
                        return;

                    // Timer für Timeout abbrechen
                    $timeout.cancel(timeoutPromise);

                    // Der Aufrufer (= iframe) kann nicht im Zuge des Aufrufes entfernt werden
                    // Deswegen wird das Entfernen mit einer Verzögerung von 0 Sekunden gesheduled
                    // Das hat zur Folge, dass kurz *NACH* (weil nur ein Thread!) der Abarbeitung
                    // dieses Codes der Timeout eintritt
                    $timeout(function () {
                        $document.find("#oauthFrame").remove();
                    }, 0);

                    deferred.resolve();
                };

                $document.find("#oauthFrame").remove();

                //var elem = $(html);
                //var e2 = angular.element(html);
                var elem = angular.element(html);
                $document.find("body").append(elem);

                return deferred.promise;
            });
        };

        this.getAccessToken = function () {
            return localStorage.getItem("access_token");
        };

        this.getIdToken = function () {
            return localStorage.getItem("id_token");
        }

        this.getIsLoggedIn = function () {
            if (this.getAccessToken() || this.getIdToken()) {

                var expiresAt = localStorage.getItem("expires_at");
                var now = new Date();
                if (expiresAt && parseInt(expiresAt) < now.getTime()) {
                    return false;
                }

                return true;
            }

            return false;
        };

        this.logOut = function () {
            localStorage.removeItem("access_token");
            localStorage.removeItem("id_token");
        };

        this.createAndSaveNonce = function () {
            // var state = this.createNonce();

            return this.createNonce().then(function (nonce) {
                localStorage.setItem("nonce", nonce);
                return nonce;
            })

        };

        this.createNonce = function () {
            
            return $http
                    .get(this.rngUrl)
                    .then(function (result) {
                        return result.data;
                    });

            //var text = "";
            //var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

            //for (var i = 0; i < 20; i++)
            //    text += possible.charAt(Math.floor(Math.random() * possible.length));

            //return text;
        };

        this.getFragment = function () {
            if (window.location.hash.indexOf("#") === 0) {
                return this.parseQueryString(window.location.hash.substr(1));
            } else {
                return {};
            }
        };

        this.parseQueryString = function (queryString) {
            var data = {}, pairs, pair, separatorIndex, escapedKey, escapedValue, key, value;

            if (queryString === null) {
                return data;
            }

            pairs = queryString.split("&");

            for (var i = 0; i < pairs.length; i++) {
                pair = pairs[i];
                separatorIndex = pair.indexOf("=");

                if (separatorIndex === -1) {
                    escapedKey = pair;
                    escapedValue = null;
                } else {
                    escapedKey = pair.substr(0, separatorIndex);
                    escapedValue = pair.substr(separatorIndex + 1);
                }

                key = decodeURIComponent(escapedKey);
                value = decodeURIComponent(escapedValue);

                if (key.substr(0, 1) === '/')
                    key = key.substr(1);

                data[key] = value;
            }

            return data;
        };
    }

    namespace.OAuthService = OAuthService;

    var isAngularApp = (window.angular != undefined);

    if (isAngularApp) {
        var app = angular.module("oauth2");
        app.service("oauthService", OAuthService);
    }
})(oauth2);