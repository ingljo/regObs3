﻿angular.module('RegObs').factory('ObservationMarker', function (MapSelectableItem, Observation, $translate, Utility, $state) {

    /**
     * Stored location marker
     * @param {}  
     * @returns {} 
     */
    var ObservationMarker = MapSelectableItem.extend({
        options: {
        
        },

        _getObservationPinHtml: function(selected) {
            var geoHazardType = Utility.getGeoHazardType(this.observation.GeoHazardTid);
            var expiery = this.observation.getDaysUntilExpiery();
            return '<div class="observation-pin' +
                (selected ? ' selected ' : ' ') +
                geoHazardType + (expiery >= 0 ? ' expiery-' + expiery : '')
                +'"><i class="icon ion-eye observation-pin-icon ' +'"></i></div>';
        },

        _getIcon: function(selected) {
            var self = this;
            return L.divIcon({
                className: 'my-div',
                html: self._getObservationPinHtml(selected)
            });
        },

        initialize: function(obsjson, options) {
            L.Util.setOptions(this, options);
            var latlng = new L.LatLng(obsjson.Latitude, obsjson.Longitude);
            this.observation = Observation.fromJson(obsjson);
            this.options.geoHazardId = obsjson.GeoHazardTid;
            this.options.selectedIcon = this._getIcon(true);
            this.options.unselectedIcon = this._getIcon(false);
            this.options.icon = this._getIcon(false);

            var self = this;
            self.options.actionButtons =
            [
                {
                    extraClasses: 'regobs-button-add',
                    buttonColor: '#fff',
                    iconColor: '#444',
                    icon: 'ion-eye',
                    onClick: function() {
                        self.onClick();
                    },
                    isVisible: function() {
                        return true;
                    }
                }
            ];

            // call super
            MapSelectableItem.prototype.initialize.call(this, latlng, this.options);
        },

        getHeader: function() {
            return this.observation.getObservationTypeDescription();
        },

        getDescription: function() {
            return this.observation.NickName || '';
        },

        hasImages: function() {
            return this.observation.hasImages();
        },

        getFirstImage: function() {
            return this.observation.getFirstImage();
        },
        getTypeDescription: function() {
            return Utility.geoHazardNames(this.observation.GeoHazardTid) +
                $translate.instant('OBSERVATION').toLowerCase();
        },
        getId: function() {
            return this.observation.RegId;
        },
        onClick: function () {
            var self = this;
            $state.go('observationdetails', { observation: self.observation });
        }
    });

    return ObservationMarker;
});