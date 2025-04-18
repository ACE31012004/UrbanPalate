# Urban Palate - Food Ordering Website Prototype

## Description

Urban Palate is an interactive front-end prototype simulating a modern online food ordering website. It allows users to sign up, log in using various methods, browse a menu fetched from a cloud database, manage a shopping cart, and place simulated orders. This project demonstrates the integration of front-end web technologies (HTML, CSS, JavaScript) with backend services provided by Firebase (Authentication and Firestore Database).

## Features

*   **User Authentication:**
    *   Sign up with Email/Password.
    *   Login with Email/Password.
    *   Sign in with Google (Popup).
    *   Sign in with Phone Number (SMS verification via reCAPTCHA).
    *   Secure session management via Firebase Auth state persistence.
    *   Logout functionality.
*   **Menu Display:**
    *   Dynamically fetches menu items (name, description, price, image) from Firestore.
    *   Displays items in an attractive card layout.
*   **Shopping Cart:**
    *   Add items to the cart from the menu.
    *   View items currently in the cart.
    *   Increase/decrease item quantity within the cart.
    *   Remove items from the cart.
    *   Real-time calculation of the total price.
    *   Cart persists across sessions using browser `localStorage`.
*   **Checkout &Okay, here is Order Placement:**
    *   Simulated checkout process requiring delivery information.
 a template for a good `README.md` file for your "Urban Palate" project on GitHub. Copy and paste this into a new file named `README    *   Order details (user ID, cart items, total, delivery info, timestamp) are saved securely to the Firestore database.
