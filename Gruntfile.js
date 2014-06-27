module.exports = function(grunt) {

    // load all grunt tasks
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-istanbul-coverage');
    grunt.loadNpmTasks('grunt-karma');
    grunt.loadNpmTasks('grunt-karma-coveralls');

    // Default task.
    grunt.registerTask('default', ['concat', 'uglify', 'clean', 'test']);
    grunt.registerTask('test', ['jshint', 'karma:jquery', 'karma:jqlite', 'coverage']);
    grunt.registerTask('travis-test', ['jshint', 'karma:jquery', 'karma:jqlite', 'coverage', 'coveralls']);

    var testConfig = function(configFile, customOptions) {
        var options = {
            configFile: configFile,
            keepalive: true
        };
        var travisOptions = process.env.TRAVIS && {
            browsers: ['PhantomJS'],
            reporters: ['dots', 'coverage']
        };
        return grunt.util._.extend(options, customOptions, travisOptions);
    };

    // Project configuration.
    grunt.initConfig({
        clean: ["coverage/*"],
        coverage: {
            options: {
                thresholds: {
                    'statements': 100,
                    'branches': 100,
                    'lines': 100,
                    'functions': 100
                },
                dir: ''
            }
        },
        coveralls: {
            options: {
                debug: true,
                coverage_dir: 'coverage',
                force: true
            }
        },
        concat: {
            js:{
                src: ['src/*.js'],
                dest: 'dist/textAngular.js'
            }
        },
        watch: {
            js: {
                files: [
                    'src/textAngular-sanitize.js',
                    'src/textAngular.js',
                    'src/textAngularSetup.js'
                ],
                tasks: ['default']
            },

            spec: {
                files: [
                    'test/taBind.spec.js',
                    'test/taExecCommand.spec.js',
                    'test/taFixChrome.spec.js',
                    'test/taMaxText.spec.js',
                    'test/taRegisterTool.spec.js',
                    'test/taSanitize.spec.js',
                    'test/taTools.spec.js',
                    'test/textAngular.spec.js',
                    'test/textAngularManager.spec.js',
                    'test/textAngularToolbar.spec.js'
                ],
                tasks: ['karma:testDev']
            }
        },
        karma: {
            jquery: {
                options: testConfig('karma-jquery.conf.js')
            },
            jqlite: {
                options: testConfig('karma-jqlite.conf.js')
            },
            testDev: {
                options: {
                    plugins: ['karma-jasmine', 'karma-coverage', 'karma-firefox-launcher', 'karma-chrome-launcher', 'karma-phantomjs-launcher'],
                    configFile: 'karma-jquery.conf.js',
                    keepalive: true,
                    browsers: ['Chrome'],
                    reporters: ['dots'],
                    singleRun: false
                }
            }
        },
        jshint: {
            files: ['src/textAngular.js', 'src/textAngularSetup.js', 'test/*.spec.js'], // don't hint the textAngularSanitize as they will fail
            options: {
                eqeqeq: true,
                immed: true,
                latedef: true,
                newcap: true,
                noarg: true,
                sub: true,
                boss: true,
                eqnull: true,
                globals: {}
            }
        },
        uglify: {
            options: {
                mangle: false,
                compress: false,
                wrap: false
            },
            my_target: {
                files: {
                    'dist/textAngular.min.js': ['src/textAngularSetup.js', 'src/textAngular.js'],
                    'dist/textAngular-sanitize.min.js': ['src/textAngular-sanitize.js']
                }
            }
        }
    });
};
