﻿angular
    .module('RegObs')
    .controller('MapAreaDownloadCtrl', function ($ionicPlatform, $ionicLoading, $filter, $ionicScrollDelegate, OfflineMap, AppLogging, AppSettings, Map, $cordovaFile, $cordovaDevice, $ionicPopup, $scope, $pbService, $state, $timeout, Utility) {
        var vm = this;

        var averageMapPartSize = 37693; //ca størrelse på kartblad
        var fragmentsFromBaseMap = 0;

        vm.size = 0;
        vm.tooBigSize = false;
        vm.availableDiskspace = '';
        vm.availableDiskspaceBytes = 0;
        vm.mapFragmentCount = 0;
        vm.maxMapZoomLevel = AppSettings.maxMapZoomLevel;
        vm.maps = AppSettings.tiles;
        vm.maps.forEach(function (item) {
            item.selected = false;
        });
        vm.maps[0].selected = true;
        vm.isLoading = true;
        vm.name = '';

        var getEstimatedSize = function (zoomlevel) {
            var fragments = Map.calculateXYZSizeFromBounds(vm.bounds, 1, zoomlevel);
            var tiles = fragments * vm.selectedMaps();
            var bytes = tiles * averageMapPartSize;
            var humanSize = Utility.humanFileSize(bytes, true);
            return { humanSize: humanSize, bytes: bytes, tiles: tiles };
        };

        vm.extraDetailLevel = [{ extraLevels: 0, description: 'Ingen' }];
        vm.selectedDetailLevel = 2;

        var calculateDetailLevels = function () {
            vm.extraDetailLevel = [{ extraLevels: 0, description: 'Ingen' }];
            if (vm.currentZoom) {
                for (var i = 2; vm.currentZoom + i <= 17 && i<=6; i += 2) {
                    var size = getEstimatedSize(vm.currentZoom + i);
                    if (size.bytes < vm.availableDiskspaceBytes) {
                        vm.extraDetailLevel.push({
                            extraLevels: i,
                            description: '+' + i + ' (' + size.humanSize + ')'
                        });
                    } else {
                        AppLogging.log('Detail size ' +i +' ' + size.humanSize + 'is larger than available ' + vm.availableDiskspace);
                        break;
                    }
                }
            }

            //Setting selected detail level to one less if levels has changed and selected value is bigger
            if (vm.extraDetailLevel[vm.extraDetailLevel.length - 1].extraLevels < vm.selectedDetailLevel) {
                vm.selectedDetailLevel = vm.extraDetailLevel[vm.extraDetailLevel.length - 1].extraLevels;
            }
        };

        vm.zoomlevel = function () {
            return (vm.currentZoom || 0) + vm.selectedDetailLevel;
        };

        vm.selectedMaps = function () {
            return vm.maps.filter(function (item) {
                return item.selected;
            }).length;
        };

        vm.mapsWithLimitReached = function () {
            return vm.maps.filter(function (item) {
                return item.limitReached === true;
            });
        };

        vm.anyMapLimitReached = function () {
            return vm.mapsWithLimitReached().length > 0;
        };

        var checkMaxLimits = function () {
            vm.maps.forEach(function (item) {
                item.limitReached = false;
                if (item.selected) {
                    if (fragmentsFromBaseMap > item.maxDownloadLimit) {
                        item.limitReached = true;
                    }
                }
            });
        };

        vm.updateCounts = function () {
            if (vm.bounds) {
                calculateDetailLevels();
                var estimatedSize = getEstimatedSize(vm.zoomlevel());
                vm.mapFragmentCount = estimatedSize.tiles;
                vm.size = estimatedSize.humanSize;
                if (estimatedSize.bytes > vm.availableDiskspaceBytes) {
                    vm.tooBigSize = true;
                } else {
                    vm.tooBigSize = false;
                }
                checkMaxLimits();
            }
        };

        vm.downloadDisabled = function () {
            return vm.tooBigSize || vm.selectedMaps() === 0 || vm.anyMapLimitReached();
        }

        var updateFreeDiskSpace = function () {
            return $cordovaFile.getFreeDiskSpace()
                    .then(function (success) {
                        var ios = $cordovaDevice.getDevice() && $cordovaDevice.getDevice().platform === 'iOS';
                        vm.availableDiskspaceBytes = success * (ios ? 1 : 1000);
                        //ios returns result in bytes, and android in kB
                        vm.availableDiskspace = Utility.humanFileSize(vm.availableDiskspaceBytes, true);
                    },
                    function (error) {
                        AppLogging.warn('Could not get available diskspace. ' + JSON.stringify(error));
                        vm.availableDiskspace = 'Ukjent';
                    }).finally(vm.updateCounts);
        };

        var cancel = false;
        $scope.cancelDownload = function () {
            cancel = true;
        };

        $scope.downloadComplete = function () {
            return $scope.downloadStatus && $scope.downloadStatus.complete;
        };

        $scope.closePopup = function () {
            if (vm.popup) {
                vm.popup.close();
            }
            $state.go('start');
        };

        $scope.progressOptions = {
            color: '#333',
            // This has to be the same size as the maximum width to
            // prevent clipping
            strokeWidth: 4,
            trailWidth: 1,
            easing: 'easeInOut',
            duration: 10,
            from: { color: '#aaa', width: 1 },
            to: { color: '#333', width: 4 },
            // Set default step function for all animate calls
            step: function (state, circle) {
                circle.path.setAttribute('stroke', state.color);
                circle.path.setAttribute('stroke-width', state.width);
                var text = '<i class="icon ion-ios-cloud-download"></i><div class="downloadprogress-percent">' + $scope.downloadStatus.percent + '%</div><div class="downloadprogress-value">(' + $scope.downloadStatus.done + '/' + $scope.downloadStatus.total + ')' + '</div>';
                circle.setText(text);
            }
        };

        var downloadMap = function () {
            var mapsToDownload = [];
            vm.maps.forEach(function (item) {
                if (item.selected) {
                    mapsToDownload.push(item.name);
                }
            });

            OfflineMap.downloadMapFromBounds(vm.name, vm.bounds, 1,
                vm.zoomlevel(),
                mapsToDownload,
                function (status) {
                    $timeout(function () {
                        $scope.downloadStatus = status;
                        $pbService.animate('progress', (status.percent / 100.0));
                        AppLogging.log('Map download progress: ' + JSON.stringify(status));
                    }, 0);
                },
                function (status) {
                    $timeout(function () {
                        $scope.downloadStatus = status;
                        $pbService.animate('progress', 1.0);
                        AppLogging.log('Map download complete: ' + JSON.stringify(status));
                    }, 0);
                },
                function () {
                    return cancel;
                });
        };

        var showProgress = function () {
            vm.popup = $ionicPopup.show({
                templateUrl: 'app/map/mapdownloadprogress.html',
                title: 'Laster ned kartblad',
                scope: $scope
            });
        };

        vm.download = function () {
            showProgress();
            downloadMap();
        };


        var init = function () {
            vm.isLoading = true;
            cancel = false;
            vm.name = $filter('date')(new Date(), 'yyyy-MM-dd HH:mm:ss');
            $ionicLoading.show();

            updateFreeDiskSpace().finally(function () {
                vm.isLoading = false;
                $ionicLoading.hide();
                $ionicScrollDelegate.resize();
            });
        };

        $scope.$on('$ionicView.enter', init);
    });