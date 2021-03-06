angular.module('RegObs')
    .controller('StartWizardCtrl', function ($scope, $state, $ionicHistory, AppSettings, RegobsPopup) {
        var vm = this;

        vm.options = {
            loop: false
        };

        vm.setAppMode = function (mode) {
            var firstLoad = !AppSettings.hasSetAppMode();

            var complete = function () {
                AppSettings.setAppMode(mode);
                $ionicHistory.clearHistory();
                $ionicHistory.nextViewOptions({
                    disableBack: true,
                    historyRoot: true
                });
                $state.go('start');
            };

            if (firstLoad) {
                RegobsPopup.showLegalInfo().then(complete);
            } else {
                complete();
            }
            
        };

        vm.nextInfoClick = function () {
            if (vm.swiper) {
                vm.swiper.slideNext();
            }
        };

        $scope.$on("$ionicSlides.sliderInitialized", function (event, data) {
            // data.slider is the instance of Swiper
            vm.swiper = data.slider;
        });

        $scope.$on('$stateChangeSuccess', function () {
            if (vm.swiper && !AppSettings.getAppMode()) {
                vm.swiper.slideTo(0, 0);
            }
        });

        $scope.$on('$ionicView.beforeEnter', function () {
            ionic.Platform.showStatusBar(false);
        });

        $scope.$on('$ionicView.afterLeave', function () {
            ionic.Platform.showStatusBar(true);
        });
    });
