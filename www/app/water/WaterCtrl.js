/**
 * Created by storskel on 03.06.2015.
 */
angular
    .module('RegObs')
    .controller('WaterCtrl', function WaterCtrl($scope) {

        function init() {
            var vm = this;
        }

        $scope.$on( '$ionicView.loaded', init.bind(this) );

    });