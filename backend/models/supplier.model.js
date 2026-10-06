const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Supplier = sequelize.define('Supplier', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    tenantId: {
      type: DataTypes.UUID,
      allowNull: false,
      // Assuming you have a Tenants table, you might want to add a foreign key constraint here
      // references: {
      //   model: 'Tenants', // Name of the target model
      //   key: 'id',       // Key in the target model that we're referencing
      // }
    },
    supplierName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Supplier name cannot be empty.'
        }
      }
    },
    contactPerson: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: {
          msg: 'Must be a valid email address.'
        }
      }
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    addressLine1: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    addressLine2: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    stateProvince: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    postalCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    country: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    website: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isUrl: {
          msg: 'Must be a valid URL.'
        }
      }
    },
    taxId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    defaultPaymentTerms: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  }, {
    tableName: 'suppliers',
    timestamps: true, // This will add createdAt and updatedAt fields
    // Sequelize options
    // indexes: [
    //   { fields: ['tenantId'] },
    //   { fields: ['supplierName', 'tenantId'], unique: true } // Example: if supplier name should be unique per tenant
    // ],
  });

  // If you have associations, define them here. For example:
  // Supplier.associate = (models) => {
  //   Supplier.belongsTo(models.Tenant, {
  //     foreignKey: 'tenantId',
  //     as: 'tenant'
  //   });
  //   // Supplier.hasMany(models.Product, { foreignKey: 'supplierId', as: 'products' });
  // };

  return Supplier;
};
