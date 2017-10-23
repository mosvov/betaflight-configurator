'use strict';

TABS.auxiliary = {};

TABS.auxiliary.initialize = function (callback) {
    GUI.active_tab_ref = this;
    GUI.active_tab = 'auxiliary';
    var prevChannelsValues = null;

    function get_mode_ranges() {
        MSP.send_message(MSPCodes.MSP_MODE_RANGES, false, false, get_box_ids);
    }

    function get_box_ids() {
        MSP.send_message(MSPCodes.MSP_BOXIDS, false, false, get_rc_data);
    }

    function get_rc_data() {
        MSP.send_message(MSPCodes.MSP_RC, false, false, get_serial_config);
    }

    function get_serial_config() {
        MSP.send_message(MSPCodes.MSP_CF_SERIAL_CONFIG, false, false, load_html);
    }

    function load_html() {
        $('#content').load("./tabs/auxiliary.html", process_html);
    }

    MSP.send_message(MSPCodes.MSP_BOXNAMES, false, false, get_mode_ranges);

    function createMode(modeIndex, modeId) {
        var modeTemplate = $('#tab-auxiliary-templates .mode');
        var newMode = modeTemplate.clone();
        
        var modeName = AUX_CONFIG[modeIndex];        
        // Adjust the name of the box if a peripheral is selected
        modeName = adjustBoxNameIfPeripheralWithModeID(modeId, modeName);

        $(newMode).attr('id', 'mode-' + modeIndex);
        $(newMode).find('.name').text(modeName);
        
        $(newMode).data('index', modeIndex);
        $(newMode).data('id', modeId);
        
        $(newMode).find('.name').data('modeElement', newMode);
        $(newMode).find('a.addRange').data('modeElement', newMode);

        return newMode; 
    }
    
    function configureRangeTemplate(auxChannelCount) {
        var rangeTemplate = $('#tab-auxiliary-templates .range');
        
        var channelList = $(rangeTemplate).find('.channel');
        var channelOptionTemplate = $(channelList).find('option');
        channelOptionTemplate.remove();

        //add value to autodetect channel
        var channelOption = channelOptionTemplate.clone();
        channelOption.text(chrome.i18n.getMessage('auxiliaryAutoChannelSelect'));
        channelOption.val(-1);
        channelList.append(channelOption);

        for (var channelIndex = 0; channelIndex < auxChannelCount; channelIndex++) {
            var channelOption = channelOptionTemplate.clone();
            channelOption.text('AUX ' + (channelIndex + 1));
            channelOption.val(channelIndex);
            channelList.append(channelOption);
        }

        channelOptionTemplate.val(-1);
    }
    
    function addRangeToMode(modeElement, auxChannelIndex, range) {
        var modeIndex = $(modeElement).data('index');

        var channel_range = {
                'min': [  900 ],
                'max': [ 2100 ]
            };
        
        var rangeValues = [1300, 1700]; // matches MultiWii default values for the old checkbox MID range.
        if (range != undefined) {
            rangeValues = [range.start, range.end];
        }

        var rangeIndex = $(modeElement).find('.range').length;
        
        var rangeElement = $('#tab-auxiliary-templates .range').clone();
        rangeElement.attr('id', 'mode-' + modeIndex + '-range-' + rangeIndex);
        modeElement.find('.ranges').append(rangeElement);
        
        $(rangeElement).find('.channel-slider').noUiSlider({
            start: rangeValues,
            behaviour: 'snap-drag',
            margin: 50,
            step: 25,
            connect: true,
            range: channel_range,
            format: wNumb({
                decimals: 0,
            })
        });

        var elementName =  '#mode-' + modeIndex + '-range-' + rangeIndex;
        $(elementName + ' .channel-slider').Link('lower').to($(elementName + ' .lowerLimitValue'));
        $(elementName + ' .channel-slider').Link('upper').to($(elementName + ' .upperLimitValue'));

        $(rangeElement).find(".pips-channel-range").noUiSlider_pips({
            mode: 'values',
            values: [900, 1000, 1200, 1400, 1500, 1600, 1800, 2000, 2100],
            density: 4,
            stepped: true
        });
        
        $(rangeElement).find('.deleteRange').data('rangeElement', rangeElement);

        $(rangeElement).find('a.deleteRange').click(function () {
            var rangeElement = $(this).data('rangeElement');
            rangeElement.remove();
        });

        $(rangeElement).find('.channel').val(auxChannelIndex);
    }

    function process_html() {
        var auxChannelCount = RC.active_channels - 4;

        configureRangeTemplate(auxChannelCount);

        var modeTableBodyElement = $('.tab-auxiliary .modes tbody') 
        for (var modeIndex = 0; modeIndex < AUX_CONFIG.length; modeIndex++) {
            
            var modeId = AUX_CONFIG_IDS[modeIndex];
            var newMode = createMode(modeIndex, modeId);
            modeTableBodyElement.append(newMode);
            
            // generate ranges from the supplied AUX names and MODE_RANGE data
            for (var modeRangeIndex = 0; modeRangeIndex < MODE_RANGES.length; modeRangeIndex++) {
                var modeRange = MODE_RANGES[modeRangeIndex];
                
                if (modeRange.id != modeId) {
                    continue;
                }
                
                var range = modeRange.range;
                if (!(range.start < range.end)) {
                    continue; // invalid!
                }
                
                addRangeToMode(newMode, modeRange.auxChannelIndex, range)
            }

        }
        
        $('a.addRange').click(function () {
            var modeElement = $(this).data('modeElement');
            //auto select AUTO option
            addRangeToMode(modeElement, -1);
        });
                
        // translate to user-selected language
        localize();

        // UI Hooks
        $('a.save').click(function () {

            // update internal data structures based on current UI elements
            
            // we must send this many back to the FC - overwrite all of the old ones to be sure.
            var requiredModesRangeCount = MODE_RANGES.length;
            
            MODE_RANGES = [];
            
            $('.tab-auxiliary .modes .mode').each(function () {
                var modeElement = $(this);
                var modeId = modeElement.data('id');
                
                $(modeElement).find('.range').each(function() {
                    
                    var rangeValues = $(this).find('.channel-slider').val();
                    var modeRange = {
                        id: modeId,
                        auxChannelIndex: parseInt($(this).find('.channel').val()),
                        range: {
                            start: rangeValues[0],
                            end: rangeValues[1]
                        }
                    };
                    MODE_RANGES.push(modeRange);
                });
            });
            
            for (var modeRangeIndex = MODE_RANGES.length; modeRangeIndex < requiredModesRangeCount; modeRangeIndex++) {
                var defaultModeRange = {
                    id: 0,
                    auxChannelIndex: 0,
                    range: {
                        start: 900,
                        end: 900
                    }
                };
                MODE_RANGES.push(defaultModeRange);
            }

            //
            // send data to FC
            //
            mspHelper.sendModeRanges(save_to_eeprom);

            function save_to_eeprom() {
                MSP.send_message(MSPCodes.MSP_EEPROM_WRITE, false, false, function () {
                    GUI.log(chrome.i18n.getMessage('auxiliaryEepromSaved'));
                });
            }
        });

       
        function box_highlight(auxChannelIndex, channelPosition) {
            if (channelPosition < 900) {
                channelPosition = 900;
            } else if (channelPosition > 2100) {
                channelPosition = 2100;
            }
        }
        
        function update_marker(auxChannelIndex, channelPosition) {
            var percentage = (channelPosition - 900) / (2100-900) * 100;
            
            $('.modes .ranges .range').each( function () {
                var auxChannelCandidateIndex = $(this).find('.channel').val();
                if (auxChannelCandidateIndex != auxChannelIndex) {
                    return;
                }
                
                $(this).find('.marker').css('left', percentage + '%');
            });
        }

        // data pulling functions used inside interval timer
        function get_rc_data() {
            MSP.send_message(MSPCodes.MSP_RC, false, false, update_ui);
        }

        function update_ui() {
            for (var i = 0; i < AUX_CONFIG.length; i++) {
                var modeElement = $('#mode-' + i); 
                if (modeElement.find(' .range').length == 0) {
                    // if the mode is unused, skip it
                    modeElement.removeClass('off').removeClass('on');
                    continue;
                }
                
                if (bit_check(CONFIG.mode, i)) {
                    $('.mode .name').eq(i).data('modeElement').addClass('on').removeClass('off');
                } else {
                    $('.mode .name').eq(i).data('modeElement').removeClass('on').addClass('off');
                }
            }

            auto_select_channel(RC.channels);

            var auxChannelCount = RC.active_channels - 4;

            for (var i = 0; i < (auxChannelCount); i++) {
                box_highlight(i, RC.channels[i + 4]);
                update_marker(i, RC.channels[i + 4]);
            }
        }

        /**
         * Autodetect channel based on maximum deference with previous value
         * minimum value to autodetect is 100 - to prevent auto select RSSI channel
         * @param RC_channels
         */
        function auto_select_channel(RC_channels) {
            var auto_option = $('.tab-auxiliary select.channel option[value="-1"]:selected');
            if (auto_option.length === 0) {
                prevChannelsValues = null;
                return;
            }

            var fillPrevChannelsValues = function () {
                prevChannelsValues = RC_channels.slice(0); //clone array
            }

            if (!prevChannelsValues || RC_channels.length === 0) return fillPrevChannelsValues();

            var diff_array = RC_channels.map(function(currentValue, index) {
                return Math.abs(prevChannelsValues[index] - currentValue);
            }, 0);

            var largest = diff_array.reduce(function(x,y){
                return (x > y) ? x : y;
            });

            //minimum change to autoselect is 100
            if (largest < 100) return fillPrevChannelsValues();

            var indexOfMaxValue = diff_array.indexOf(largest);
            if (indexOfMaxValue >= 4){ //set channel
                auto_option.parent().val(indexOfMaxValue - 4);
            }

            return fillPrevChannelsValues();
        }

        // update ui instantly on first load
        update_ui();

        // enable data pulling
        GUI.interval_add('aux_data_pull', get_rc_data, 50);

        // status data pulled via separate timer with static speed
        GUI.interval_add('status_pull', function () {
            MSP.send_message(MSPCodes.MSP_STATUS);
        }, 250, true);

        GUI.content_ready(callback);
    }
};

TABS.auxiliary.cleanup = function (callback) {
    if (callback) callback();
};
