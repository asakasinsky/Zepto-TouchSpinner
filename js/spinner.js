(function($) {
    var proxy = $.proxy;

    function clone(obj) {
        if (null == obj || "object" != typeof obj) return obj;
        var copy = obj.constructor();
        for (var attr in obj) {
            if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
        }
        return copy;
    }

    var defaultOptions = {
            culture: null,
            icons: {
                down: "icon-triangle-1-s",
                up: "icon-triangle-1-n"
            },
            incremental: true,
            max: null,
            min: null,
            numberFormat: null,
            page: 10,
            step: 1,

            change: null,
            spin: null,
            start: null,
            stop: null
        };

    var SpinnerMethods = {
        $: {},
        timer: null,
        previous: 0,
        spinning: false,
    };

    SpinnerMethods.init = function(el, options) {
        this.$ = {
            input: $(el)
        };
        this.$.container = this.$.input.parent()
        this.options = $.extend({}, defaultOptions, options || {});
        this.create();
    };

    SpinnerMethods.create = function() {
        // handle string values that need to be parsed
        this.setOption('max', this.options.max);
        this.setOption('min', this.options.min);
        this.setOption('step', this.options.step);

        this.draw();

        // format the value, but don't constrain
        this.value(this.$.input.val(), true);

        this.$.container
            .on('touchstart', '.spinner-button', proxy(function(event) {
                var that = this,
                    previous;

                previous = this.$.input[0] === document.activeElement ?
                    this.previous : this.$.input.val();

                event.preventDefault();
                if (this.start(event) === false) {
                    return;
                }

                this.repeat(null, $(event.currentTarget).hasClass('spinner-up') ? 1 : -1, event);
            }, this))
            .on('touchend', '.spinner-button', proxy(this.stop, this))
        ;

        this.refresh();
    };

    SpinnerMethods.draw = function() {
        var uiSpinner = this.$.uiSpinner = this.$.input
            .addClass('spinner-input')
            .attr('autocomplete', 'off')
            .wrap(this.uiSpinnerHtml())
            .parent()
            .append(this.buttonHtml());

        this.$.value = $(this.valueHtml());
        this.$.input.attr('role', 'spinbutton');
        this.$.buttons = uiSpinner.find('.spinner-button')
            .attr('tabIndex', -1);

        uiSpinner.prepend(this.$.value);

        // disable spinner if element was already disabled
        if (this.options.disabled) {
            this.disable();
        }
    };

    SpinnerMethods.valueHtml = function() {
        return '<span class="spinner-value"></span>';
    };

    SpinnerMethods.uiSpinnerHtml = function() {
        return '<div class="spinner"></div>';
    };

    SpinnerMethods.buttonHtml = function() {
        return "<a class='spinner-button spinner-up'>" +
            "<span class='" + this.options.icons.up + "'>&#9650;</span>" +
            "</a>" +
            "<a class='spinner-button spinner-down'>" +
            "<span class='" + this.options.icons.down + "'>&#9660;</span>" +
            "</a>";
    };

    SpinnerMethods.start = function(event) {
        if (this.spinning === true) {
            return false;
        }

        this.$.input.trigger('spinner:start', event);

        if (!this.counter) {
            this.counter = 1;
        }
        this.spinning = true;
        return true;
    };

    SpinnerMethods.repeat = function(i, steps, event)  {
        i = i || 500;
        if (this.timer) {
            clearTimeout(this.timer);
        }
        this.timer = setTimeout(proxy(function() {
            this.repeat(40, steps, event);
        }, this), i);
        this.spin(steps * this.options.step, event);
    };

    SpinnerMethods.spin = function(step, event) {
        if (this.spinning !== true) {
            return;
        }

        var value = this.value() || 0;
        if (!this.counter ) {
            this.counter = 1;
        }

        value = this.adjustValue(value + step * this.increment(this.counter));
        this.$.input.trigger('spinner:spin', event, { value: value });
        this.value(value);
        this.counter++;
    };

    SpinnerMethods.increment = function(i) {
        var incremental = this.options.incremental;
        if (incremental) {
            return $.isFunction(incremental) ?
                incremental(i) :
                Math.floor(i*i*i/50000 - i*i/500 + 17*i/200 + 1);
        }
        return 1;
    };

    SpinnerMethods.precision = function() {
        var precision = this.precisionOf(this.options.step);
        if (this.options.min !== null) {
            precision = Math.max(precision, this.precisionOf(this.options.min));
        }
        return precision;
    };

    SpinnerMethods.precisionOf = function(num) {
        var str = num.toString(),
            decimal = str.indexOf('.');
        return decimal === -1 ? 0 : str.length - decimal - 1;
    };

    SpinnerMethods.adjustValue = function(value) {
        var base, aboveMin,
            options = this.options;

        // make sure we're at a valid step
        // - find out where we are relative to the base (min or 0)
        base = options.min !== null ? options.min : 0;
        aboveMin = value - base;
        // - round to the nearest step
        aboveMin = Math.round(aboveMin / options.step) * options.step;
        // - rounding is based on 0, so adjust back to our base
        value = base + aboveMin;

        // fix precision from bad JS floating point math
        value = parseFloat(value.toFixed(this.precision()));

        // clamp the value
        if ( options.max !== null && value > options.max) {
            return options.max;
        }
        if ( options.min !== null && value < options.min ) {
            return options.min;
        }

        return value;
    };

    SpinnerMethods.stop = function(event) {
        if (this.spinning !== true) {
            return;
        }
        clearTimeout(this.timer);
        this.counter = 0;
        this.spinning = false;
        this.$.input.trigger('spinner:stop', event);
    };

    SpinnerMethods.setOption = function(key, value) {
        if (key === 'culture' || key === 'numberFormat') {
            var prevValue = this.parse(this.$.input.val()),
                formatedValue = this.format(prevValue);
            this.options[key] = value;
            this.$.input.val(formatedValue);
            this.$.value.text(formatedValue);
            return;
        }

        if (key === 'max' || key === 'min' || key === 'step') {
            if (typeof value === 'string') {
                value = this.parse(value);
            }
        }

        if (this.options.hasOwnProperty(key)) {
            this.options[key] = value;
        }

        if (key === 'disabled') {
            if (value) {
                this.$.input.prop('disabled', true);
                this.$.buttons.button('disable');
            } else {
                this.$.input.prop('disabled', false);
                this.$.buttons.button('enable');
            }
        }
    };

    SpinnerMethods.setOptions = function(options) {
        if (options) {
            this.options = $.extend(this.options, options || {});
        }
    };

    SpinnerMethods.parse = function(val) {
        if (typeof val === 'string' && val !== '') {
            val = window.Globalize && this.options.numberFormat ?
                Globalize.parseFloat(val, 10, this.options.culture) : +val;
        }
        return val === '' || isNaN(val) ? null : val;
    };

    SpinnerMethods.format = function(value) {
        if (value === '') {
            return '';
        }
        return window.Globalize && this.options.numberFormat ?
            Globalize.format(value, this.options.numberFormat, this.options.culture) :
            value;
    };

    SpinnerMethods.refresh = function() {
        this.$.input.attr({
            'data-valuemin': this.options.min,
            'data-valuemax': this.options.max,
            'data-valuenow': this.parse(this.$.input.val())
        });
    };

    // update the value without triggering change
    SpinnerMethods.value = function(value, allowAny) {
        if (arguments.length) {
            var parsed;
            if (value !== '') {
                parsed = this.parse(value);
                if (parsed !== null) {
                    if (!allowAny) {
                        parsed = this.adjustValue(parsed);
                    }
                    value = this.format(parsed);
                }
            }
            this.$.input.val(value);
            this.$.value.text(value);
            this.refresh();
        }
        return this.parse(this.$.input.val());
    };

    SpinnerMethods.destroy = function() {
        this.$.input
            .removeClass('ui-spinner-input')
            .prop('disabled', false)
            .removeAttr('autocomplete')
            .removeAttr('role')
            .removeAttr('data-valuemin')
            .removeAttr('data-valuemax')
            .removeAttr('data-valuenow');

        this.uiSpinner.replaceWith(this.$.input);
    };

    SpinnerMethods.stepUp = function(steps) {
        this.spin((steps || 1) * this.options.step);
    };

    SpinnerMethods.stepDown = function(steps) {
        this.spin((steps || 1) * -this.options.step);
    };

    SpinnerMethods.pageUp = function(pages) {
        this.stepUp((pages || 1) * this.options.page);
    };

    SpinnerMethods.pageDown = function(pages) {
        this.stepDown((pages || 1) * this.options.page);
    };

    /**
     * Spinner
     */
    var Spinner = function(el, options) {
        this.init(el, options);
    };

    $.extend(Spinner.prototype, SpinnerMethods);

    /**
     * TimeSpinner
     */
    var TimeSpinner = function(el, options) {
        this.init(el, options);
    };

    $.extend(TimeSpinner.prototype, SpinnerMethods, {
        init: function(el, options) {
            this.$.input = $(el);
            this.$.container = this.$.input.parent();
            this.options = $.extend({}, defaultOptions, {
                step: 60 * 1000, // seconds
                minutesStep: 1,
                page: 60 // hours
            });
            if (options) {
                this.options = $.extend({}, this.options, options);
            }
            this.options.step = this.options.step * this.options.minutesStep;
            this.create();
        },
        parse: function(value) {
            if (typeof value === 'string') {
                if (Number(value) == value ) {
                    return Number(value);
                }
                return +Globalize.parseDate(value);
            }
            return value;
        },
        format: function(value) {
            return Globalize.format(new Date(value), 't');
        }
    });

    $.fn.Spinner = function(options) {
        return this.each(function() {
            if (!(this.Spinner instanceof Spinner)) {
                this.Spinner = new Spinner(this, options);
            }
        });
    };

    $.fn.TimeSpinner = function(options) {
        return this.each(function() {
            if (!(this.TimeSpinner instanceof TimeSpinner)) {
                this.TimeSpinner = new TimeSpinner(this, options);
            }
        });
    };
}(Zepto));