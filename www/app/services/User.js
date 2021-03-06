angular
    .module('RegObs')
    .factory('User', function User($http, LocalStorage, AppSettings, RegobsPopup, AppLogging, $rootScope) {
        var service = this;
        var storageKey = 'regobsUser';
        var user;

        service.loggingIn = false;

        service.logIn = function (username, password) {
            service.loggingIn = true;
            var endpoints = AppSettings.getEndPoints();

            var config = {
                headers: {
                    Authorization: 'Basic ' + btoa(username + ':' + password)
                },
                timeout: AppSettings.httpConfig && AppSettings.httpConfig.timeout ? AppSettings.httpConfig.timeout : 15000,
                cache: false
            };
            return $http.post(endpoints.login, {}, config).then(function (response) {
                user = response.data;
                user.email = username;
                user.password = password;
                service.save();
                AppLogging.log("Logged in user", user);
                $rootScope.$broadcast('$regObs:userLogin');
                service.loggingIn = false;

            }, function (response) {
                AppLogging.log(response);
                var status = '';
                if (response.status === 401) {
                    status = 'Feil brukernavn eller passord. Vennligst fyll inn på nytt og prøv igjen.';
                } else if (response.status <= 0) {
                    status = 'Det er problemer med å nå tjenesten. Har du nett? Det kan hende at serverapplikasjonen må våkne og få seg en dugelig sterk kopp med kaffe først. Gi den noen minutter og prøv igjen.';
                } else {
                    status = 'Det oppsto en feil ved innlogging. Melding fra server: ' + response.statusText;
                }
                RegobsPopup.alert('Oisann!', status);
                service.loggingIn = false;
            });
        };

        service.logOut = function () {
            user = makeAnonymousUser();
            service.save();
            $rootScope.$broadcast('$regObs:userLogout');
        };

        service.getUser = function () {
            return user;
        };

        service.setChosenObserverGroup = function (id) {
            user.chosenObserverGroup = id;
            service.save();
        };

        service.refreshObserverGroups = function () {
            if (!user.anonymous) {
                service.logIn(user.email, user.password);
            }
        };

        service.getObserverGroups = function () {
            var ret = [];
            if (!user.anonymous) {
                var groups = user.ObserverGroup;
                if (angular.isArray(groups)) {
                    ret = groups;
                } else {
                    //API backward compatibility for ObserverGroup
                    for (var g in groups) {
                        ret.push({ Id: g, Name: groups[g] });
                    };
                }
            }
            return ret;
        };

        service.save = function () {
            LocalStorage.setObject(storageKey, user);
            $rootScope.$broadcast('$regObs:userInfoSaved');
        };

        service.load = function () {
            user = LocalStorage.getAndSetObject(storageKey, 'password', makeAnonymousUser());
        };

        service.load();

        return service;

        function makeAnonymousUser() {
            return {
                Guid: (AppSettings.data.env === 'demo' ? 'A9D7E614-2EE4-4589-B490-A36DDB586AF9' : '92E6A41D-8E7B-46A8-8957-3F14AA2544A0'),
                ObserverGroup: null,
                anonymous: true
            };
        }

    });
