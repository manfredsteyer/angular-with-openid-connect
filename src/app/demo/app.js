var app = angular.module("demo", ["oauth2", "ui.router"]);

app.config(function ($stateProvider, $urlRouterProvider, $locationProvider) {
    $locationProvider.html5Mode(false);

    $urlRouterProvider.otherwise('/home');

    $stateProvider.state('home', {
        url: '/home',
        templateUrl: '/app/demo/home.html',
    }).state('voucher', {
        url: '/voucher',
        templateUrl: '/app/demo/voucher.html',
        controller: 'VoucherCtrl',
        restricted: true
    }).state('login', {
        url: '/login?requestedUrl',
        templateUrl: '/app/demo/login.html',
        controller: 'LoginCtrl'
    }).state('logout', {
        url: '/logout',
        templateUrl: '/app/demo/logout.html',
        controller: 'LogoutCtrl'
    });

});

app.constant("voucherApiUrl", "http://angular.at");
app.constant("authUrl", "https://accounts.google.com/o/oauth2/auth");

app.run(function (oauthService, $http, $state, $rootScope, $location, voucherApiUrl, authUrl) {

    oauthService.rngUrl = voucherApiUrl + "/api/random";
    oauthService.loginUrl = authUrl;
    oauthService.redirectUri = location.origin + "/index.html";

    oauthService.clientId = "482348825399.apps.googleusercontent.com";
    oauthService.scope = "openid email";
    oauthService.issuer = "accounts.google.com";
    oauthService.oidc = true;

    $rootScope.$on("$stateChangeStart", function (event, toState, toParams, fromState, fromParams) {

        if (toState.restricted && !oauthService.getIsLoggedIn()) {
            event.preventDefault();
            var requestedUrl = $state.href(toState, toParams); // #/voucher

            $state.transitionTo("login", { requestedUrl: requestedUrl });
        }

    });

    if (oauthService.tryLogin()) {
        $http.defaults.headers.common['Authorization'] = 'Bearer ' + oauthService.getIdToken();

        if (oauthService.state) {
            $location.url(oauthService.state.substr(1)); // cut # off
        }
    }

    $rootScope.global = {};
    $rootScope.global.logOut = function () {
        oauthService.logOut();
        $state.go("login");
    }

    var claims = oauthService.getClaims();
    if (claims) {
        $rootScope.global.userName = claims.email;
    }

});

app.controller("VoucherCtrl", function ($scope, $http, oauthService, voucherApiUrl) {

    $scope.model = {};
    //$scope.oauth = oauthService;

    $scope.model.message = "";
    
    $scope.model.buyVoucher = function () {
        $http
            .post(voucherApiUrl + "/api/OidcVoucher?amount=150", null)
            .then(function (result) {
                $scope.model.message = result.data;
        })
        .catch(function (message) {
                $scope.model.message = "Fehler beim Abrufen des Gutscheins: " + message.status;
        });
    }

   

})

app.controller("LoginCtrl", function ($scope, $stateParams, oauthService, $http) {

    $scope.model = {
        requestedUrl: $stateParams.requestedUrl,
        callback: function(requestedUrl) {
            $http.defaults.headers.common['Authorization'] = 'Bearer ' + oauthService.getAccessToken();
        }
    };

});

app.controller("LogoutCtrl", function (oauthService) {
    oauthService.logOut();
})