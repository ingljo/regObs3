﻿angular
    .module('RegObs')
    .controller('ConfirmTimeCtrl', function ($scope, Registration, $state) {
        var ctrl = this;

        ctrl.setToNow = function () {
            ctrl.time = new Date(moment().seconds(0).milliseconds(0).toISOString());
        };

        ctrl.onChange = function () {
            var now = new Date();
            if (!ctrl.time || (ctrl.time > now)) {
                ctrl.time = now;
            }
        };

        ctrl.save = function () {
            Registration.data.DtObsTime = ctrl.time.toISOString();
            Registration.save();

            $state.go('newregistration');
        };

        $scope.$on('$ionicView.enter', function () {
            var time = new Date();
            if (Registration.data && Registration.data.DtObsTime) {
                time = new Date(Registration.data.DtObsTime);
            }

            time = new Date(moment(time).seconds(0).milliseconds(0).toISOString());

            ctrl.time = time;
        });

    });