module.exports = {
    content: [
        // General
        'helpers/**/*.js',

        // Nuxt
        'components/**/*.vue',
        'layouts/**/*.vue',
        'pages/**/*.vue',
        'plugins/**/*.js',

        // Eleventy
        'layouts-eleventy/**/*.js',
        'pages-eleventy/**/*.js',

        // Astro
        'src/**/*.astro',
        'src/**/*.vue',
        'src/**/*.js',
    ],
    future: {
        purgeLayersByDefault: true,
    },
    theme: {
        extend: {
            container: {
                center: true,
                padding: '1.5rem',
                screens: {
                    lg: '1040px',
                    xl: '1040px',
                    '2xl': '1040px',
                }
            },
            colors: {

                // Color Generator
                // https://coolors.co/362932-5f444b-ffa766-e3d8f1-f52f57-faff81

                // 'red': '#b63a23', // Original
                // 'red': 'rgb(232, 49, 81)', // Vibrant
                // 'red': 'rgb(195, 47, 39)', // Close to original red
                // 'red': 'rgb(239, 48, 84)', // More Vibrant
                'red': 'rgb(245, 47, 87)', // More Vibrant

                // 'dark': '#75413a',
                'dark': '#34393f',

                'darker': '#191a1d',

                'darkest': '#121416',

                // 'gold': '#d78649',
                'gold': 'rgb(255, 167, 102)',
                // 'gold': 'rgb(222, 115, 90)',

                // 'orange': '#ed8936',

                'off_white': '#ecebe6',


                // Lightness

                'white-1': 'rgba(255, 255, 255, 0.1)',
                'white-2': 'rgba(255, 255, 255, 0.2)',
                'white-3': 'rgba(255, 255, 255, 0.3)',
                'white-4': 'rgba(255, 255, 255, 0.4)',
                'white-5': 'rgba(255, 255, 255, 0.5)',
                'white-6': 'rgba(255, 255, 255, 0.6)',
                'white-7': 'rgba(255, 255, 255, 0.7)',
                'white-8': 'rgba(255, 255, 255, 0.8)',
                'white-9': 'rgba(255, 255, 255, 0.9)',

                'black-1': 'rgba(0, 0, 0, 0.1)',
                'black-7': 'rgba(0, 0, 0, 0.7)',
                'black-9': 'rgba(0, 0, 0, 0.9)'

            },
            fontFamily: {
                primary: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
                secondary: 'Inter, Georgia, Cambria, "Times New Roman", Times, serif',
                emoji: 'sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
            },
            letterSpacing: {
                wide: '0.3em',
                wider: '0.4em',
                widest: '0.5em',
            },
            height: {
                '1/2-screen': '50vh',
                'full-screen': '100vh'
            },
            width: {
                '1/2-screen': '50vw',
                'full-screen': '100vw',
                '2x-screen': '200vw'
            },
            minHeight: {
                '1/2-screen': '50vh',
                '3/4-screen': '75vh',
            },
            spacing: {
                '16/9': '56.25%',
                '1/2-screen': '50vw',
            },
            inset: {
                '1/2': '50%',
            },
            opacity: {
                '10': '.1',
            },
            zIndex: {
                'navbar': '400',
                'main': '300'
            }
        }
    },
    variants: {
        backgroundImage: ['responsive', 'hover']
    },
    // plugins: [
    //     require( 'daisyui' )
    // ],

    // // daisyUI config
    // // https://daisyui.com/docs/config/
    // daisyui: {
    //     // styled: false,
    //     // themes: false,
    //     // base: false,
    //     // utils: false,
    //     // logs: true,
    //     // rtl: false,
    //     prefix: 'daisy',
    //     darkTheme: 'dark',
    // },
}
