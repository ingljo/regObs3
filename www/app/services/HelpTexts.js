﻿angular.module('RegObs').factory('HelpTexts', function (LocalStorage, $http, AppSettings, $q) {
    var service = this;

    service._localStorageKey = 'helptexts';

    service._getAppEmbeddedHelpTexts = function () {
        return $http.get('app/json/helptexts.json').then(function (result) {
            return result.data;
        });
    };

    service._getStorageKey = function () {
        return service._localStorageKey + '_' + AppSettings.data.env.replace(/ /g, '');
    };

    service._getLocalStorageHelpTexts = function () {
        return LocalStorage.getObject(service._getStorageKey(), []);
    };

    service._getHelpTexts = function () {
        var updatedElements = service._getLocalStorageHelpTexts();
        if (updatedElements.length > 0) {
            return $q(function (resolve) {
                resolve(updatedElements);
            });
        } else {
            return service._getAppEmbeddedHelpTexts();
        }
    };

    service._getHelpText = function (tid, geoHazardId, langKey) {
        return service._getHelpTexts()
            .then(function (result) {
                if (angular.isString(tid)) {
                    tid = parseInt(tid);
                }

                var filtered = result.filter(function (item) {
                    return item.RegistrationTID === tid && item.GeoHazardTID === geoHazardId && item.LangKey === langKey;
                });
                if (filtered.length > 0) {
                    return filtered[0].Text || '';
                } else {
                    return '';
                }
            });
    };

    service.updateHelpTexts = function () {
        var config = angular.copy(AppSettings.httpConfig);
        config.params = { langKey: AppSettings.getCurrentLangKey() };
        return $http.get(AppSettings.getEndPoints().getHelpTexts, config)
            .then(function (res) {
                if (angular.isArray(res.data) && res.data.length > 0) {
                    LocalStorage.set(service._getStorageKey(), JSON.stringify(res.data));
                    return true;
                }
                return false;
            });
    };

    service.getHelpText = function (tid, geoHazardId) {
        return service._getHelpText(tid, geoHazardId, AppSettings.getCurrentLangKey());
    };

    return service;
});