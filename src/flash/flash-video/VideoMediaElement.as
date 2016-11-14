﻿package {	import flash.display.*;	import flash.events.*;	import flash.media.*;	import flash.net.*;	import flash.system.*;	import flash.external.*;	import flash.utils.Timer;	public class VideoMediaElement extends Sprite {		private var _connection:NetConnection;		private var _stream:NetStream;		private var _video:Video;		private var _display:Sprite;		private var _soundTransform:SoundTransform;		private var _oldVolume:Number = 1;		private var _autoplay:Boolean = false;		private var _isPaused:Boolean = true;		private var _isLoaded:Boolean = false;		private var _isEnded:Boolean = false;		private var _isMuted:Boolean = false;		private var _isConnected:Boolean = false;		private var _playWhenConnected:Boolean = false;		private var _hasStartedPlaying:Boolean = false;		private var _isPreloading:Boolean = false;		private var _framerate:Number = 0;		private var _bytesLoaded:Number = 0;		private var _bytesTotal:Number = 0;		private var _bufferEmpty:Boolean = false;		private var _seekOffset:Number = 0;		private var _videoWidth:Number = -1;		private var _videoHeight:Number = -1;		private var _src:String = '';		private var _volume:Number = 1;		private var _duration:Number = 0;		private var _timer:Timer;		private var _id:String;		private var _isRTMP:Boolean = false;		private var _rtmpInfo:Object = null;		private var _streamer:String = "";		private var _pseudoStreamingEnabled:Boolean = false;		private var _pseudoStreamingStartQueryParam:String = "start";		private var _pseudoStreamingType:String = "time";		private var _pseudoStreamingBytePositions:Array = [];		private var _nativeVideoWidth:Number = 0;		private var _nativeVideoHeight:Number = 0;		private var _stageWidth:Number;		private var _stageHeight:Number;		/**		 * @constructor		 */		public function VideoMediaElement() {			var flashVars:Object = LoaderInfo(this.root.loaderInfo).parameters;			_id = flashVars.uid;			_autoplay = (flashVars.autoplay == true);			log (flashVars.pseudostreamstart);			_pseudoStreamingEnabled = flashVars.pseudostreamstart != null;			_pseudoStreamingStartQueryParam = flashVars.pseudostreamstart != null ? flashVars.pseudostreamstart : 'start';			_pseudoStreamingType = flashVars.pseudostreamtype != null ? flashVars.pseudostreamtype : 'time';			// stage setup			stage.align = StageAlign.TOP_LEFT;			stage.scaleMode = StageScaleMode.NO_SCALE;			_stageWidth = stage.stageWidth;			_stageHeight = stage.stageHeight;			stage.addEventListener(Event.RESIZE, stageResizeHandler);			stage.addEventListener(MouseEvent.MOUSE_DOWN, stageClickHandler);			stage.addEventListener(MouseEvent.MOUSE_OVER , stageMouseOverHandler);			stage.addEventListener(Event.MOUSE_LEAVE, stageMouseLeaveHandler);			stage.addEventListener(Event.RESIZE, fire_setSize);			// video setup			_display = new Sprite();			addChild(_display);			_video = new Video();			_display.addChild(_video);			_display.addEventListener(MouseEvent.MOUSE_OVER, stageMouseOverHandler);			_display.x = _video.x = 0;			_display.y = _video.y = 0;			_display.width = _video.width = _stageWidth;			_display.height = _video.height = _stageHeight;			_connection = new NetConnection();			_connection.client = { onBWDone: function():void{} };			_connection.addEventListener(NetStatusEvent.NET_STATUS, netStatusHandler);			_connection.addEventListener(SecurityErrorEvent.SECURITY_ERROR, securityErrorHandler);			_timer = new Timer(250);			_timer.addEventListener(TimerEvent.TIMER, timerHander);			if (ExternalInterface.available) {				// Getters				ExternalInterface.addCallback('get_src', get_src);				ExternalInterface.addCallback('get_volume',get_volume);				ExternalInterface.addCallback('get_currentTime', get_currentTime);				ExternalInterface.addCallback('get_muted', get_muted);				ExternalInterface.addCallback('get_buffered', get_buffered);				ExternalInterface.addCallback('get_duration', get_duration);				ExternalInterface.addCallback('get_paused', get_paused);				ExternalInterface.addCallback('get_ended', get_ended);				// Setters				ExternalInterface.addCallback('set_src', set_src);				ExternalInterface.addCallback('set_volume', set_volume);				ExternalInterface.addCallback('set_currentTime', set_currentTime);				ExternalInterface.addCallback('set_muted', set_muted);				// Methods				ExternalInterface.addCallback('fire_load', fire_load);				ExternalInterface.addCallback('fire_play', fire_play);				ExternalInterface.addCallback('fire_pause', fire_pause);				ExternalInterface.addCallback('fire_setSize', fire_setSize);				ExternalInterface.addCallback('fire_stop', fire_stop);				ExternalInterface.call('__ready__' + _id);			}		}		//		// Javascript bridged methods		//		private function fire_load():void {			if (!_isLoaded && _src) {				if (_isConnected && _stream) {					_stream.pause();					_stream.close();					_connection.close();				}				_isConnected = false;				_isPreloading = false;				_isPaused = true;				_isEnded = false;				_bufferEmpty = false;				if (_isRTMP) {					_connection.connect(_rtmpInfo.server);				} else {					_connection.connect(null);				}				sendEvent("loadstart");				if (_autoplay) {					fire_play();				}			}		}		private function fire_play():void {			if (!_hasStartedPlaying && !_isConnected) {				_playWhenConnected = true;				fire_load();				return;			}			if (_hasStartedPlaying) {				if (_isEnded) {					_stream.seek(0);				}				if (_isPaused) {					_stream.resume();					_timer.start();					_isPaused = false;					sendEvent("play");					sendEvent("playing");				}			} else {				if (_isRTMP) {					_stream.play(_rtmpInfo.stream);				} else {					_stream.play(getUrlPosition(0));				}				_timer.start();				_isPaused = false;				_hasStartedPlaying = true;			}		}		private function fire_pause():void {			if (_stream == null) {				return;			}			_stream.pause();			_isPaused = true;			if (_bytesLoaded == _bytesTotal) {				_timer.stop();			}			_isPaused = true;			sendEvent("pause");		}		private function fire_stop():void {			if (_stream == null) {				return;			}			_stream.close();			_isPaused = false;			_timer.stop();			sendEvent("stop");		}		private function fire_setSize(width: Number=-1, height: Number=-1): void {			var fill:Boolean = false;			var contWidth:Number;			var contHeight:Number;			var stageRatio:Number;			var nativeRatio:Number;			_video.x = 0;			_video.y = 0;			contWidth = stage.stageWidth;			contHeight = stage.stageHeight;			if(width == -1){				width = _video.width;			}			if(height == -1){				height = _video.height;			}			if (width <= 0 || height <= 0) {				fill = true;			}			if (fill) {				_video.width = width;				_video.height = height;			} else {				stageRatio = contWidth/contHeight;				nativeRatio = _videoWidth/_videoHeight;				// adjust size and position				if (nativeRatio > stageRatio) {					_video.width = contWidth;					_video.height =  _videoHeight * contWidth / _videoWidth;					_video.y = contHeight/2 - _video.height/2;				} else if (stageRatio > nativeRatio) {					_video.width = _videoWidth * contHeight / _videoHeight;					_video.height =  contHeight;					_video.x = contWidth/2 - _video.width/2;				} else if (stageRatio == nativeRatio) {					_video.width = contWidth;					_video.height = contHeight;				}			}		}		//		// Setters		//		private function set_src(value:String = ''):void {			if (_isConnected && _stream) {				_stream.pause();			}			_src = value;			_isConnected = false;			_hasStartedPlaying = false;			_isLoaded = false;			_isRTMP = !!_src.match(/^rtmp(s|t|e|te)?\:\/\//) || _streamer != "";			if (_isRTMP) {				_rtmpInfo = parseRTMP(_src);			}		}		private function set_muted(value:*):void {			if (_isConnected && _stream) {				if (value == true) {					_oldVolume = _volume;					_isMuted = true;					set_volume(0);				} else {					_isMuted = false;					if (_oldVolume > 0) {						set_volume(_oldVolume);					} else {						set_volume(1);					}				}			}		}		private function set_volume(value:Number = NaN):void {			if (!isNaN(value)) {				if (_stream != null) {					_soundTransform = new SoundTransform(value);					_stream.soundTransform = _soundTransform;				}				_volume = value;				sendEvent("volumechange");			}		}		private function set_currentTime(value:Number = NaN):void {			if (_stream == null)				return;			sendEvent("seeking");			_stream.seek(value);			sendEvent("timeupdate");		}		//		// Getters		//		private function get_src():String {			return _src;		}		private function get_paused():Boolean {			return _isPaused;		}		private function get_muted():Boolean {			return _isMuted;		}		private function get_volume():Number {			return _volume;		}		private function get_currentTime():Number {			var currentTime:Number = 0;			if (_stream != null) {				currentTime = _stream.time;				if (_pseudoStreamingEnabled && "time" == _pseudoStreamingType) {					currentTime += _seekOffset;				}			}			return currentTime;		}		private function get_duration():Number {			return _duration;		}		private function get_buffered():Number {			if (_bytesTotal > 0) {				return _bytesLoaded / _bytesTotal * _duration;			} else {				return 0;			}		}		private function get_ended():Boolean {			return _isEnded;		}		//		// Event handlers		//		private function ioErrorHandler(event:Event):void {			sendEvent("error");		}		private function timerHander(event:TimerEvent):void {			_bytesLoaded = _stream.bytesLoaded;			_bytesTotal = _stream.bytesTotal;			if (!_isPaused)				sendEvent("timeupdate");			if (_bytesLoaded < _bytesTotal)				sendEvent("progress");		}		private function metaDataHandler(info:Object):void {			// store main info			_duration = info.duration;			_framerate = info.framerate;			_videoWidth = info.width;			_videoHeight = info.height;			// reposition			_nativeVideoWidth = _video.videoWidth;			_nativeVideoHeight = _video.videoHeight;			repositionVideo();			// For byte based pseudo-streaming, find seekpoints from metadata			if (_pseudoStreamingEnabled && _pseudoStreamingType == 'byte') {				findBytePosition(info);			}			sendEvent("loadedmetadata");			if (_isPreloading) {				_stream.pause();				_isPaused = true;				_isPreloading = false;				sendEvent("progress");				sendEvent("timeupdate");			}		}		private function netStatusHandler(event:NetStatusEvent):void {			switch (event.info.code) {				case "NetStream.Buffer.Empty":					_bufferEmpty = true;					if (_isEnded) {						sendEvent("ended");					}					break;				case "NetStream.Buffer.Full":					_bytesLoaded = _stream.bytesLoaded;					_bytesTotal = _stream.bytesTotal;					_bufferEmpty = false;					sendEvent("seeked");					sendEvent("progress");					break;				case "NetConnection.Connect.Success":					connectStream();					break;				case "NetStream.Play.StreamNotFound":					sendEvent('error', 'Unable to locate video');					break;				// STREAM				case "NetStream.Play.Start":					_isPaused = false;					sendEvent("loadeddata");					sendEvent("canplay");					if (!_isPreloading) {						sendEvent("play");						sendEvent("playing");					}					_timer.start();					break;				case "NetStream.Seek.Complete":					sendEvent("seeked");					break;				case "NetStream.Pause.Notify":					_isPaused = true;					sendEvent("pause");					break;				case "NetStream.Play.Stop":					if (_hasStartedPlaying) {						_isEnded = true;						_isPaused = false;						_timer.stop();						if (_bufferEmpty) {							sendEvent("ended");						}					}					break;			}		}		private function securityErrorHandler(event:SecurityErrorEvent):void {			trace("securityErrorHandler: " + event);		}		private function asyncErrorHandler(event:AsyncErrorEvent):void {			// ignore AsyncErrorEvent events.		}		private function stageClickHandler(e:MouseEvent):void {			sendEvent("click");		}		private function stageMouseOverHandler(e:MouseEvent):void {			//ExternalInterface.call('console.log', 'flash mouseover');			sendEvent("mouseover");		}		private function stageMouseLeaveHandler(e:Event):void {			//ExternalInterface.call('console.log', 'flash mouseout');			sendEvent("mouseout");			sendEvent("mouseleave");		}		private function stageResizeHandler(e:Event):void {			repositionVideo();		}		//		// Utilities		//		private function sendEvent(eventName: String, eventMessage: String = ''): void {			ExternalInterface.call('__event__' + _id, eventName, eventMessage);		}		private function log(): void {			if (ExternalInterface.available) {				ExternalInterface.call('console.log', arguments);			} else {				trace(arguments);			}		}		private function connectStream():void {			log("connectStream");			_stream = new NetStream(_connection);			// explicitly set the sound since it could have come before the connection was made			_soundTransform = new SoundTransform(_volume);			_stream.soundTransform = _soundTransform;			_stream.addEventListener(NetStatusEvent.NET_STATUS, netStatusHandler); // same event as connection			_stream.addEventListener(AsyncErrorEvent.ASYNC_ERROR, asyncErrorHandler);			var customClient:Object = new Object();			customClient.onMetaData = metaDataHandler;			_stream.client = customClient;			_video.attachNetStream(_stream);			_isConnected = true;			if (_playWhenConnected && !_hasStartedPlaying) {				fire_play();				_playWhenConnected = false;			}		}		private function repositionVideo():void {		}		private function parseRTMP(url:String):Object {			var match:Array = url.match(/(.*)\/((flv|mp4|mp3):.*)/);			var rtmpInfo:Object = {				server: null,				stream: null			};			if (match) {				rtmpInfo.server = match[1];				rtmpInfo.stream = match[2];			} else {				rtmpInfo.server = url.replace(/\/[^\/]+$/,"/");				rtmpInfo.stream = url.split("/").pop();			}			return rtmpInfo;		}		private function getUrlPosition(pos:Number):String {			var url:String = _src;			if (_pseudoStreamingEnabled) {				url += (url.indexOf('?') > -1) ? '&' : '?';				url += _pseudoStreamingStartQueryParam + '=';				url += ("byte" == _pseudoStreamingType) ? getBytePosition(pos).toString() : pos.toString();			}			return url;		}		private function findBytePosition(info:Object):void {			_pseudoStreamingBytePositions.splice(0);			var i:int;			if (info.keyframes) {				for (i=0; i<info.keyframes.times.length; i++) {					var seekpoint:Object = { time:Number, offset:Number };					seekpoint.time = info.keyframes.times[i];					seekpoint.offset = info.keyframes.filepositions[i];					_pseudoStreamingBytePositions.push(seekpoint);				}			}			if (info.seekpoints) {				for (i=0; i<info.seekpoints.length; i++) {					_pseudoStreamingBytePositions.push(info.seekpoints[i]);				}			}			_pseudoStreamingBytePositions.sortOn('time', Array.NUMERIC);		}		private function getBytePosition(time:Number):Number {			var i:int;			for (i=0; i<_pseudoStreamingBytePositions.length; i++) {				if (_pseudoStreamingBytePositions[i].time >= time && time <= _pseudoStreamingBytePositions[i + 1].time) {					return _pseudoStreamingBytePositions[i].offset;				}			}			return 0;		}	}}