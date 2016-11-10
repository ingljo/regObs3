angular
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
                        //Registration.data.DtObsTime = newTime.toISOString();
                        scope.regObject[scope.regProp] = newTime.toISOString();
                    } else {
                        //Registration.data.DtObsTime = now.toISOString();
                        scope.regObject[scope.regProp] = now.toISOString();
                        scope.DtObsTime = now;
                    }
                });
            };

            scope.getText = function () {
                return scope.text || 'Observasjonstidspunkt';
            };

            scope.$watch('regObject', function (newVal) {
                if (scope.regObject) {
                    scope.DtObsTime = new Date(scope.regObject[scope.regProp]);
                }
            });


        }

        return {
            require: '?^form',
            scope: {
                regObject: '=',
                regProp: '@',
                text: '@'
            },
            link: link,
            template: [
                '<label class="item item-input item-stacked-label">',
                    '<span class="input-label" ng-bind="::getText()" ng-class="{assertive:formCtrl[regProp].$invalid}"></span>',
                    '<input name="{{regProp}}" type="datetime-local" ng-change="timeChanged(DtObsTime)" ng-model="DtObsTime" required>',
                '</label>'
            ].join('')
        };
    });
