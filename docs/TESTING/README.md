# Testing

This section covers the testing strategy, tools, and practices used in the Zettaz Cloud Enterprise application to ensure code quality and reliability.

## Testing Philosophy

The Zettaz Cloud Enterprise testing approach follows these key principles:

1. **Test Pyramid**: Focus on a healthy mix of unit, integration, and end-to-end tests
2. **Shift Left**: Identify and fix issues early in the development process
3. **Continuous Testing**: Integrate testing into the CI/CD pipeline
4. **Code Coverage**: Aim for meaningful code coverage rather than arbitrary percentage targets
5. **Test-Driven Development (TDD)**: Write tests before implementing features when possible

## Testing Types

### Unit Tests

Unit tests focus on testing individual components, functions, or classes in isolation from their dependencies.

**Key Characteristics:**
- Fast execution
- No database or external service dependencies
- Focus on logic and edge cases
- High code coverage

**Tools:**
- **Backend**: Jest
- **Frontend**: Vitest, React Testing Library

### Integration Tests

Integration tests verify that different parts of the application work together correctly.

**Key Characteristics:**
- Test interactions between components
- May include database interactions
- Focus on contracts and interfaces
- Medium execution speed

**Tools:**
- **Backend**: Jest with Supertest
- **Frontend**: Vitest with React Testing Library

### End-to-End Tests

End-to-end tests validate the entire application flow from user interface to database and back.

**Key Characteristics:**
- Test complete user journeys
- Run against a fully deployed application
- Slower execution speed
- Critical for validating business processes

**Tools:**
- Playwright

### API Tests

API tests specifically target the REST API endpoints, ensuring they handle requests and responses correctly.

**Key Characteristics:**
- Focus on request/response validation
- Test authentication and authorization
- Verify error handling
- Medium execution speed

**Tools:**
- Postman/Newman
- Supertest with Jest

## Testing Directory Structure

### Backend Tests

```
/backend
  /tests
    /unit
      /controllers
      /services
      /utils
    /integration
      /routes
      /database
    /fixtures
      /users.js
      /products.js
      /orders.js
    /helpers
      /testDb.js
      /authHelper.js
```

### Frontend Tests

```
/frontend
  /src
    /components
      /Button
        Button.tsx
        Button.test.tsx
    /pages
      /Login
        Login.tsx
        Login.test.tsx
    /hooks
      /useCart
        useCart.ts
        useCart.test.ts
    /tests
      /e2e
        /specs
        /fixtures
        /utils
```

## Backend Testing

### Setting Up a Test

```javascript
// Example of a controller unit test

const { getAllProducts, getProductById } = require('../../controllers/productController');
const db = require('../../config/database');

// Mock the database module
jest.mock('../../config/database', () => ({
  query: jest.fn(),
  withTransaction: jest.fn((callback) => callback({ query: jest.fn() }))
}));

describe('Product Controller', () => {
  let req;
  let res;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup request and response objects
    req = {
      params: {},
      query: {},
      user: { tenant_id: 'test-tenant-id' }
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });
  
  describe('getAllProducts', () => {
    it('should return all products for the tenant', async () => {
      // Arrange
      const mockProducts = [
        { id: '1', name: 'Product 1' },
        { id: '2', name: 'Product 2' }
      ];
      
      db.query.mockResolvedValueOnce([[...mockProducts], []]);
      
      // Act
      await getAllProducts(req, res);
      
      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM products'),
        expect.arrayContaining(['test-tenant-id'])
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        data: mockProducts
      }));
    });
    
    it('should handle database errors', async () => {
      // Arrange
      db.query.mockRejectedValueOnce(new Error('Database error'));
      
      // Act
      await getAllProducts(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.any(String)
      }));
    });
  });
  
  describe('getProductById', () => {
    it('should return a specific product by ID', async () => {
      // Arrange
      const mockProduct = { id: '1', name: 'Product 1' };
      req.params.id = '1';
      
      db.query.mockResolvedValueOnce([[mockProduct], []]);
      
      // Act
      await getProductById(req, res);
      
      // Assert
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM products WHERE id = ?'),
        expect.arrayContaining(['1', 'test-tenant-id'])
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        data: mockProduct
      }));
    });
    
    it('should return 404 when product not found', async () => {
      // Arrange
      req.params.id = 'non-existent-id';
      
      db.query.mockResolvedValueOnce([[], []]);
      
      // Act
      await getProductById(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.stringContaining('not found')
      }));
    });
  });
});
```

### Testing Database Interactions

For database integration tests, we use a test database and transactions:

```javascript
// testDb.js helper
const mysql = require('mysql2/promise');

const createTestConnection = async () => {
  const connection = await mysql.createConnection({
    host: process.env.TEST_DB_HOST || 'localhost',
    user: process.env.TEST_DB_USER || 'test_user',
    password: process.env.TEST_DB_PASSWORD || 'test_password',
    database: process.env.TEST_DB_NAME || 'zettaz_test'
  });
  
  return connection;
};

const setupTestTransaction = async (connection) => {
  await connection.query('START TRANSACTION');
  return async () => {
    await connection.query('ROLLBACK');
  };
};

module.exports = {
  createTestConnection,
  setupTestTransaction
};
```

```javascript
// Example of a database integration test
const { createTestConnection, setupTestTransaction } = require('../../helpers/testDb');
const productRepository = require('../../repositories/productRepository');

describe('Product Repository', () => {
  let connection;
  let rollback;
  
  beforeAll(async () => {
    connection = await createTestConnection();
  });
  
  beforeEach(async () => {
    rollback = await setupTestTransaction(connection);
  });
  
  afterEach(async () => {
    await rollback();
  });
  
  afterAll(async () => {
    await connection.end();
  });
  
  it('should create a product and return the ID', async () => {
    // Arrange
    const productData = {
      name: 'Test Product',
      sku: 'TEST-001',
      tenant_id: 'test-tenant-id',
      price: 9.99,
      cost: 5.99
    };
    
    // Act
    const productId = await productRepository.createProduct(connection, productData);
    
    // Assert
    expect(productId).toBeTruthy();
    
    // Verify product was created
    const [rows] = await connection.query(
      'SELECT * FROM products WHERE id = ? AND tenant_id = ?',
      [productId, 'test-tenant-id']
    );
    
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe('Test Product');
    expect(rows[0].price).toBe(9.99);
  });
});
```

## Frontend Testing

### Component Tests

```jsx
// Example of a component test with React Testing Library
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import Button from './Button';

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click Me</Button>);
    
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
  });
  
  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click Me</Button>);
    
    const button = screen.getByRole('button', { name: /click me/i });
    fireEvent.click(button);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
  
  it('can be disabled', () => {
    render(<Button disabled>Click Me</Button>);
    
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeDisabled();
  });
  
  it('renders with different variants', () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>);
    let button = screen.getByRole('button', { name: /primary/i });
    expect(button).toHaveClass('bg-primary');
    
    rerender(<Button variant="secondary">Secondary</Button>);
    button = screen.getByRole('button', { name: /secondary/i });
    expect(button).toHaveClass('bg-secondary');
  });
});
```

### Form Tests

```jsx
// Example of a form test
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import LoginForm from './LoginForm';

describe('LoginForm', () => {
  it('submits the form with user input', async () => {
    const handleSubmit = vi.fn();
    render(<LoginForm onSubmit={handleSubmit} />);
    
    // Fill out the form
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    });
    
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' }
    });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    
    // Check that the submit handler was called with the correct data
    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });
    });
  });
  
  it('shows validation errors for invalid input', async () => {
    render(<LoginForm onSubmit={vi.fn()} />);
    
    // Submit without filling the form
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    
    // Check for validation error messages
    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });
});
```

### Custom Hook Tests

```jsx
// Example of a custom hook test
import { renderHook, act } from '@testing-library/react-hooks';
import { vi } from 'vitest';
import useCart from './useCart';

// Mock the API service
vi.mock('../../services/api', () => ({
  addToCart: vi.fn().mockResolvedValue({ success: true }),
  removeFromCart: vi.fn().mockResolvedValue({ success: true })
}));

describe('useCart', () => {
  it('initializes with empty cart', () => {
    const { result } = renderHook(() => useCart());
    
    expect(result.current.items).toEqual([]);
    expect(result.current.itemCount).toBe(0);
    expect(result.current.total).toBe(0);
  });
  
  it('adds an item to the cart', async () => {
    const { result } = renderHook(() => useCart());
    
    const product = {
      id: '1',
      name: 'Test Product',
      price: 10
    };
    
    await act(async () => {
      await result.current.addItem(product, 2);
    });
    
    expect(result.current.items).toEqual([
      {
        id: '1',
        name: 'Test Product',
        price: 10,
        quantity: 2,
        subtotal: 20
      }
    ]);
    
    expect(result.current.itemCount).toBe(2);
    expect(result.current.total).toBe(20);
  });
  
  it('removes an item from the cart', async () => {
    const { result } = renderHook(() => useCart());
    
    // Add an item first
    const product = {
      id: '1',
      name: 'Test Product',
      price: 10
    };
    
    await act(async () => {
      await result.current.addItem(product, 2);
    });
    
    // Now remove it
    await act(async () => {
      await result.current.removeItem('1');
    });
    
    expect(result.current.items).toEqual([]);
    expect(result.current.itemCount).toBe(0);
    expect(result.current.total).toBe(0);
  });
});
```

## End-to-End Testing

End-to-end tests use Playwright to simulate user interactions with the application.

```javascript
// Example of a Playwright E2E test
const { test, expect } = require('@playwright/test');

test.describe('Authentication', () => {
  test('should allow a user to log in', async ({ page }) => {
    // Navigate to the login page
    await page.goto('/login');
    
    // Fill in the login form
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    
    // Click the login button
    await page.click('button[type="submit"]');
    
    // Verify redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    
    // Verify user is logged in
    await expect(page.locator('.user-profile')).toContainText('Test User');
  });
  
  test('should show error for invalid credentials', async ({ page }) => {
    // Navigate to the login page
    await page.goto('/login');
    
    // Fill in the login form with invalid credentials
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'wrong-password');
    
    // Click the login button
    await page.click('button[type="submit"]');
    
    // Verify error message
    await expect(page.locator('.error-message')).toContainText('Invalid credentials');
    
    // Verify we're still on the login page
    await expect(page).toHaveURL('/login');
  });
});

test.describe('Product Management', () => {
  test.beforeEach(async ({ page }) => {
    // Log in before each test
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'admin-password');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
  });
  
  test('should display product list', async ({ page }) => {
    // Navigate to the products page
    await page.click('text=Products');
    
    // Verify we're on the products page
    await expect(page).toHaveURL('/products');
    
    // Verify product list is displayed
    await expect(page.locator('.product-table')).toBeVisible();
    await expect(page.locator('.product-row')).toHaveCount.greaterThan(0);
  });
  
  test('should add a new product', async ({ page }) => {
    // Navigate to the products page
    await page.click('text=Products');
    
    // Click the add product button
    await page.click('text=Add Product');
    
    // Fill in the product form
    await page.fill('input[name="name"]', 'New Test Product');
    await page.fill('input[name="sku"]', 'TEST-NEW-001');
    await page.fill('input[name="price"]', '19.99');
    await page.fill('input[name="cost"]', '9.99');
    
    // Submit the form
    await page.click('button[type="submit"]');
    
    // Verify success message
    await expect(page.locator('.success-message')).toContainText('Product created successfully');
    
    // Verify the new product appears in the list
    await expect(page.locator('.product-table')).toContainText('New Test Product');
  });
});
```

## Test Coverage

We use Jest's built-in coverage reporter to measure test coverage:

```bash
# Backend coverage
cd backend
npm test -- --coverage

# Frontend coverage
cd frontend
npm run test:coverage
```

**Coverage Targets:**
- **Backend**: 80% overall, 90% for critical modules
- **Frontend**: 70% overall, 85% for critical components and hooks

## Continuous Integration

Tests are automatically run in the CI pipeline on each pull request and merge to main:

1. **Linting**: ESLint and Prettier
2. **Unit Tests**: Run all unit tests for backend and frontend
3. **Integration Tests**: Run integration tests against a test database
4. **E2E Tests**: Run critical user journey tests
5. **Coverage Report**: Generate and archive coverage reports

## Mock Data

For testing, we use fixture files to provide consistent test data:

```javascript
// /backend/tests/fixtures/products.js
module.exports = [
  {
    id: '550e8400-e29b-41d4-a716-446655440000',
    tenant_id: 'test-tenant-id',
    name: 'Test Product 1',
    sku: 'TEST-001',
    price: 19.99,
    cost: 9.99,
    current_stock_quantity: 100,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z'
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    tenant_id: 'test-tenant-id',
    name: 'Test Product 2',
    sku: 'TEST-002',
    price: 29.99,
    cost: 19.99,
    current_stock_quantity: 50,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z'
  }
];
```

## Best Practices

### Do's

1. **Write Readable Tests**: Use descriptive test names and clear assertions
2. **Isolate Tests**: Each test should be independent and not rely on other tests
3. **Test Behavior, Not Implementation**: Focus on what the code does, not how it does it
4. **Use Setup and Teardown**: Properly initialize and clean up test state
5. **Mock External Dependencies**: Avoid real API calls or database queries in unit tests
6. **Test Edge Cases**: Cover error conditions, boundary values, and special cases

### Don'ts

1. **Don't Over-Mock**: Excessive mocking can lead to tests that don't reflect real behavior
2. **Don't Test Third-Party Code**: Focus on testing your own code
3. **Don't Write Brittle Tests**: Avoid tests that break with minor changes
4. **Don't Ignore Failed Tests**: Address failures promptly
5. **Don't Skip Testing Error Handling**: Ensure error paths are tested

## Test-Driven Development (TDD)

For new features, we encourage the TDD approach:

1. **Write a failing test** that defines the desired behavior
2. **Implement the minimum code** needed to pass the test
3. **Refactor** the code while ensuring tests still pass

This approach helps ensure that code is testable and meets requirements from the start.

## Troubleshooting Common Test Issues

### Tests Fail Intermittently

Possible causes:
- Race conditions in asynchronous code
- Shared state between tests
- Time-dependent tests

Solutions:
- Use proper async/await or Promise handling
- Reset state between tests
- Mock time-dependent functions

### Slow Tests

Possible causes:
- Actual database or API calls in unit tests
- Inefficient test setup
- Too many assertions in a single test

Solutions:
- Use mocks for external dependencies
- Optimize test setup
- Split large tests into smaller ones

### Test Coverage Gaps

Possible causes:
- Complex conditional logic
- Error handling paths
- Edge cases not considered

Solutions:
- Use branch coverage metrics
- Write tests specifically for error paths
- Add tests for boundary conditions
