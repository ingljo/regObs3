﻿angular
    .module('RegObs')
    .controller('RegistrationCtrl', function SnowRegistrationCtrl($scope, Registration, Utility, Property) {
        var vm = this;
        vm.hasFooter = function () {
            return Registration.showSend();
        };

        vm.getTitle = function () {
            if (vm.reg) {
                return Utility.getGeoHazardType(vm.reg.GeoHazardTID).toUpperCase() + '_OBSERVATION';
            }
            return '';
        };

        vm.propertyExists = function (prop) {
            return Property.exists(prop);
        };

        vm.save = function () {
            Registration.save();        
        };

        $scope.$on('$ionicView.enter', function () {
            vm.reg = Registration.data;
        });
    });
