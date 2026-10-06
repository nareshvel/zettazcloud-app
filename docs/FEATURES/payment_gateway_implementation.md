# TODO: Payment Gateway Implementation

This document outlines the steps required to fully implement the Payment Gateway Configuration feature in the Settings page.

## Backend Tasks
- [ ] **Create Database Schema:** Design and create tables to store payment gateway credentials securely for each store/tenant.
  - `payment_gateways` (id, tenant_id, name, type, is_active)
  - `payment_gateway_configs` (id, gateway_id, key, value) - Encrypt sensitive values.
- [ ] **Create API Endpoints:** Develop secure RESTful endpoints for CRUD operations on payment gateway configurations.
  - `GET /api/v1/settings/payment-gateways`: List configured gateways for the store.
  - `GET /api/v1/settings/payment-gateways/:id`: Get details of a specific gateway.
  - `POST /api/v1/settings/payment-gateways`: Add a new gateway (e.g., Stripe, PayPal).
  - `PUT /api/v1/settings/payment-gateways/:id`: Update credentials for a gateway.
  - `DELETE /api/v1/settings/payment-gateways/:id`: Deactivate or remove a gateway.
- [ ] **Implement Service Logic:** Write the business logic to handle validation, encryption of secrets, and interaction with the database.
- [ ] **Add Security:** Ensure only authorized users (e.g., store owners, admins) can manage these settings. Encrypt all sensitive keys at rest.

## Frontend Tasks
- [ ] **Activate Form:** Remove the `disabled` attributes from the inputs and buttons in `SettingsPayments.tsx`.
- [ ] **State Management:** Implement state management (e.g., using `useState` or a global state manager) to handle form inputs and API data.
- [ ] **API Integration:** Connect the frontend component to the backend API endpoints.
  - Fetch existing configurations when the component mounts.
  - Implement `handleSave` functions for each gateway to POST/PUT data.
  - Handle loading states and display user feedback (e.g., success/error toasts).
- [ ] **Improve UI/UX:**
  - Add a "Connect" button that might initiate an OAuth flow for services that support it.
  - Show a "Connected" status with an option to "Disconnect" or "Edit".
  - Add validation for key formats.

## Testing
- [ ] **Backend:** Write unit and integration tests for the API endpoints and service logic.
- [ ] **Frontend:** Write component tests for `SettingsPayments.tsx`.
- [ ] **E2E:** Perform end-to-end testing to ensure the full flow of adding, editing, and using a payment gateway works correctly.
