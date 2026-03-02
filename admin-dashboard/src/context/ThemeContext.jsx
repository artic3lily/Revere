import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState("dark"); // Default to dark, per Revere standards

    useEffect(() => {
        // Check local storage
        const saved = localStorage.getItem("adminTheme");
        if (saved) {
            setTheme(saved);
        } else {
            // Check system preference
            const sysLight = window.matchMedia("(prefers-color-scheme: light)").matches;
            if (sysLight) setTheme("light");
        }
    }, []);

    useEffect(() => {
        localStorage.setItem("adminTheme", theme);
        if (theme === "light") {
            document.body.classList.add("light");
            document.body.classList.remove("dark");
        } else {
            document.body.classList.add("dark");
            document.body.classList.remove("light");
        }
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === "dark" ? "light" : "dark"));
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
