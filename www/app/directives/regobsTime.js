﻿angular
    .module('RegObs')
    .directive('regobsTime', function ($timeout, AppLogging) {
        function link(scope, elem, attrs, formCtrl) {
            scope.formCtrl = formCtrl;

            scope.timeChanged = function (time) {
                AppLogging.log('time changed', scope.regObject);
                $timeout(function () {
                    if (!scope.regObject) {
                        scope.regObject = {};
                    }

                    var now = new Date();
                    var newTime = new Date(time);
                    if (newTime < now) {
                        scope.regObject[scope.regProp] = newTime.toISOString();
                    } else {
                        scope.regObject[scope.regProp] = now.toISOString();
                        scope.DtObsTime = now;
                    }
                    if (scope.onChange && angular.isFunction(scope.onChange)) {
                        scope.onChange();
                    }
                });
            };

            scope.getText = function () {
                return scope.text || '';
            };

            scope.$watch('regObject', function (newVal) {
                if (scope.regObject) {
                    if (scope.regObject[scope.regProp]){
                        scope.DtObsTime = new Date(scope.regObject[scope.regProp]);
                    } else {
                        scope.DtObsTime = undefined;
                    }
                }
            });
        }

        return {
            require: '?^form',
            scope: {
                regObject: '=',
                regProp: '@',
                text: '@',
                onChange: '&?',
                onBlur: '&?'
            },
            link: link,
            template: [
                '<label class="item item-input item-stacked-label">',
                '<span class="input-label" ng-bind="::getText()" ng-class="{assertive:formCtrl[regProp].$invalid}"></span>',
                '<input name="{{regProp}}" type="datetime-local" ng-change="timeChanged(DtObsTime)" ng-blur="onBlur()" ng-model="DtObsTime" required>',
                '</label>'
            ].join('')
        };
    });