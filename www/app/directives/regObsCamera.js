angular
    .module('RegObs')
    .directive('regobsCamera', function ($ionicPlatform, $cordovaCamera, $cordovaDeviceOrientation, $state, AppSettings, Pictures) {
        'ngInject';

        return {
            link: link,
            replace: true,
            scope: {},
            template: '<button type="button" class="button button-clear button-block" ng-click="click()"><i class="icon stable ion-camera"></i> Foto</button>'
        };

        function link(scope) {

            scope.click = window.Camera && function () {
                    $ionicPlatform.ready(function () {
                        var options = {
                            quality: 100,
                            destinationType: Camera.DestinationType.FILE_URI,
                            sourceType: Camera.PictureSourceType.CAMERA,
                            allowEdit: false,
                            encodingType: Camera.EncodingType.JPEG,
                            targetWidth: 1200,
                            targetHeight: 1200,
                            popoverOptions: CameraPopoverOptions,
                            saveToPhotoAlbum: true,
                            correctOrientation: true
                        };

                        snapPic(options);
                    });
                }
        }

        function snapPic(options) {
            $cordovaCamera
                .getPicture(options)
                .then(function (imageUri) {
                    var pic = Pictures.addPicture($state.current.data.registrationProp, imageUri);
                    //image.src = "data:image/jpeg;base64," + imageData;
                    if (AppSettings.data.compass) {
                        setOrientation(pic);
                    }
                }, function (err) {
                    // error
                });
        }

        function setOrientation(pic) {
            $cordovaDeviceOrientation
                .getCurrentHeading()
                .then(function (result) {
                    /*var trueHeading = result.trueHeading;
                     var accuracy = result.headingAccuracy;
                     var timeStamp = result.timestamp;*/
                    var magneticHeading = result.magneticHeading;
                    pic.Aspect = magneticHeading.toFixed(0);
                }, function (err) {
                    // An error occurred
                    pic.Aspect = -1;
                });
        }

    });