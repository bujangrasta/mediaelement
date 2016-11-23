/**
 * Stop button
 *
 * This feature enables the displaying of a Stop button in the control bar, which basically pauses the media and rewinds
 * it to the initial position.
 */
(function ($) {

	// Feature configuration
	$.extend(mejs.MepDefaults, {
		/**
		 * @type {Boolean}
		 */
		supportVR: false,
		/**
		 * https://developers.google.com/vr/concepts/vrview-web#vr_view
		 */
		vr: {
			image: 'blank.png',
			preview: 'blank.png',
			is_stereo: true,
			is_autopan_off: true,
			is_debug: false,
			is_vr_off: false,
			default_yaw: 0,
			is_yaw_only: false
		}
	});

	$.extend(MediaElementPlayer.prototype, {

		/**
		 * Feature constructor.
		 *
		 * Always has to be prefixed with `build` and the name that will be used in MepDefaults.features list
		 * @param {MediaElementPlayer} player
		 * @param {$} controls
		 * @param {$} layers
		 * @param {HTMLElement} media
		 */
		buildvr: function (player, controls, layers, media) {
			var
				t = this
			;

			if (!t.isVideo || !t.options.supportVR || (t.isVideo && t.media.rendererName !== null &&
				!t.media.rendererName.match(/(native|html5)/))) {
				return;
			}

			var
				url = media.getSrc(),
				mediaFiles = [{src: url, type: mejs.Utility.getTypeFromFile(url)}]
			;

			renderInfo = mejs.Renderers.selectRenderer(mediaFiles, ['vr']);
			media.changeRenderer(renderInfo.rendererName, mediaFiles);
		}
	});

})(mejs.$);
