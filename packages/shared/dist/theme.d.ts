/**
 * Digital Guru Franchise Enterprise Shared Design System Tokens
 * Source of truth for Branding, Web (Tailwind/CSS), and Multi-Tenant Franchise Theming.
 */
export declare const digitalGuruBrand: {
    name: string;
    companyName: string;
    tagline: string;
    colors: {
        blue: string;
        gold: string;
        orange: string;
        navy: string;
        slate: string;
        light: string;
    };
    typography: {
        display: string;
        body: string;
    };
    contact: {
        phone: string;
        email: string;
        campuses: {
            name: string;
            city: string;
            address: string;
            phone: string;
        }[];
        social: {
            facebook: string;
            instagram: string;
            linkedin: string;
            twitter: string;
        };
        collaboration: {
            partnerName: string;
            partnerUrl: string;
        };
    };
};
export declare const themeTokens: {
    colors: {
        brandBlue: string;
        brandGold: string;
        brandOrange: string;
        brandNavy: string;
        espresso: string;
        cocoa: string;
        primary: string;
        taupe: string;
        mocha: string;
        greige: string;
        beige: string;
        background: string;
        surface: string;
        surfaceMuted: string;
        border: string;
        borderSubtle: string;
        textPrimary: string;
        textSecondary: string;
        textMuted: string;
        textSubtle: string;
        textLight: string;
        textLightMuted: string;
        success: string;
        successBg: string;
        successBorder: string;
        warning: string;
        warningBg: string;
        warningBorder: string;
        error: string;
        errorBg: string;
        errorBorder: string;
        info: string;
        infoBg: string;
        infoBorder: string;
    };
    spacing: {
        xs: number;
        sm: number;
        md: number;
        lg: number;
        xl: number;
        xxl: number;
        xxxl: number;
    };
    radii: {
        sm: number;
        md: number;
        lg: number;
        xl: number;
        full: number;
    };
    typography: {
        fontFamily: string;
        sizes: {
            xs: number;
            sm: number;
            base: number;
            lg: number;
            xl: number;
            xxl: number;
            title: number;
        };
        weights: {
            normal: "400";
            medium: "500";
            semibold: "600";
            bold: "700";
            black: "800";
        };
    };
    shadows: {
        card: {
            shadowColor: string;
            shadowOffset: {
                width: number;
                height: number;
            };
            shadowOpacity: number;
            shadowRadius: number;
            elevation: number;
        };
        cardHover: {
            shadowColor: string;
            shadowOffset: {
                width: number;
                height: number;
            };
            shadowOpacity: number;
            shadowRadius: number;
            elevation: number;
        };
        modal: {
            shadowColor: string;
            shadowOffset: {
                width: number;
                height: number;
            };
            shadowOpacity: number;
            shadowRadius: number;
            elevation: number;
        };
    };
};
//# sourceMappingURL=theme.d.ts.map