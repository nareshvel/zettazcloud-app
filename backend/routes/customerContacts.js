const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const { authenticate, authorize, requireTenantId, requireStoreId } = require('../middleware/unifiedAuthMiddleware');

// Get contacts for a specific customer
router.get('/customers/:customerId/contacts', authenticate, async (req, res) => {
  const { customerId } = req.params;
  
  try {
    const [contacts] = await pool.query(
      `SELECT * FROM customer_contacts WHERE customer_id = ? ORDER BY is_primary DESC, first_name ASC`,
      [customerId]
    );
    
    res.json({
      success: true,
      data: contacts
    });
  } catch (error) {
    console.error('Error fetching customer contacts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer contacts',
      error: error.message
    });
  }
});

// Add a new contact to a customer
router.post('/customers/:customerId/contacts', authenticate, async (req, res) => {
  const { customerId } = req.params;
  const { first_name, last_name, email, phone, is_primary, position } = req.body;
  
  if (!first_name) {
    return res.status(400).json({
      success: false,
      message: 'First name is required'
    });
  }
  
  try {
    // If this contact is set as primary, un-set any existing primary contacts
    if (is_primary) {
      await pool.query(
        `UPDATE customer_contacts SET is_primary = 0 WHERE customer_id = ?`,
        [customerId]
      );
    }
    
    const contactId = uuidv4();
    await pool.query(
      `INSERT INTO customer_contacts 
      (id, customer_id, first_name, last_name, email, phone, is_primary, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [contactId, customerId, first_name, last_name, email, phone, is_primary ? 1 : 0, position]
    );
    
    // Log this activity
    await logCustomerActivity(customerId, req.user?.id || "system", 'contact_added', `Added contact: ${first_name} ${last_name || ''}`);
    
    const [newContact] = await pool.query(
      `SELECT * FROM customer_contacts WHERE id = ?`,
      [contactId]
    );
    
    res.status(201).json({
      success: true,
      message: 'Contact added successfully',
      data: newContact[0]
    });
  } catch (error) {
    console.error('Error adding customer contact:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add customer contact',
      error: error.message
    });
  }
});

// Update a contact
router.put('/contacts/:contactId', authenticate, async (req, res) => {
  const { contactId } = req.params;
  const { first_name, last_name, email, phone, is_primary, position } = req.body;
  
  if (!first_name) {
    return res.status(400).json({
      success: false,
      message: 'First name is required'
    });
  }
  
  try {
    // Get the customer ID for this contact
    const [contactRows] = await pool.query(
      `SELECT customer_id FROM customer_contacts WHERE id = ?`,
      [contactId]
    );
    
    if (contactRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }
    
    const customerId = contactRows[0].customer_id;
    
    // If this contact is set as primary, un-set any existing primary contacts
    if (is_primary) {
      await pool.query(
        `UPDATE customer_contacts SET is_primary = 0 WHERE customer_id = ? AND id != ?`,
        [customerId, contactId]
      );
    }
    
    await pool.query(
      `UPDATE customer_contacts 
      SET first_name = ?, last_name = ?, email = ?, phone = ?, is_primary = ?, position = ?
      WHERE id = ?`,
      [first_name, last_name, email, phone, is_primary ? 1 : 0, position, contactId]
    );
    
    // Log this activity
    await logCustomerActivity(customerId, req.user?.id || "system", 'contact_updated', `Updated contact: ${first_name} ${last_name || ''}`);
    
    const [updatedContact] = await pool.query(
      `SELECT * FROM customer_contacts WHERE id = ?`,
      [contactId]
    );
    
    res.json({
      success: true,
      message: 'Contact updated successfully',
      data: updatedContact[0]
    });
  } catch (error) {
    console.error('Error updating customer contact:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update customer contact',
      error: error.message
    });
  }
});

// Delete a contact
router.delete('/contacts/:contactId', authenticate, async (req, res) => {
  const { contactId } = req.params;
  
  try {
    // Get the contact details before deletion for logging
    const [contactRows] = await pool.query(
      `SELECT * FROM customer_contacts WHERE id = ?`,
      [contactId]
    );
    
    if (contactRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }
    
    const contact = contactRows[0];
    
    await pool.query(
      `DELETE FROM customer_contacts WHERE id = ?`,
      [contactId]
    );
    
    // Log this activity
    await logCustomerActivity(
      contact.customer_id, 
      req.user?.id || "system", 
      'contact_deleted', 
      `Deleted contact: ${contact.first_name} ${contact.last_name || ''}`
    );
    
    res.json({
      success: true,
      message: 'Contact deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting customer contact:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete customer contact',
      error: error.message
    });
  }
});

// Helper function to log customer activities
async function logCustomerActivity(customerId, userId, activityType, description) {
  try {
    const activityId = uuidv4();
    await pool.query(
      `INSERT INTO customer_activity_log 
      (id, customer_id, user_id, activity_type, description)
      VALUES (?, ?, ?, ?, ?)`,
      [activityId, customerId, userId, activityType, description]
    );
    return true;
  } catch (error) {
    console.error('Error logging customer activity:', error);
    return false;
  }
}

module.exports = router;
