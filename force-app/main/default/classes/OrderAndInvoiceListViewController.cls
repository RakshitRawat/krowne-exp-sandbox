public with sharing class OrderAndInvoiceListViewController {
    
    @AuraEnabled
    public static List<Map<String, String>> getOrders(
        String searchKey,
        Boolean fetchOnHoldOrders,
        Integer dayRange,
        Integer limitSize,
        String orderFilterName,
        Date lastShipDate,
        Id lastRecordId
    ) {
        try {
            System.debug('limitSize --->'+ limitSize);
            System.debug('lastRecordId--->'+ lastRecordId);
            List<Map<String, String>> orders = new List<Map<String, String>>();
            String searchPattern = '%' + (searchKey != null ? searchKey : '') + '%';

            String query =
                'SELECT Id, PoNumber, Project_Name__c, OrderNumber, Account.Name, ' +
                'EffectiveDate, EndDate, Mark_4_Project__c, GP_Amount__c, Tracking_Status__c, ' +
                'Owner.Name, CreatedDate, Status, LastModifiedDate, ' +
                'Order_Document_Number__c, Order_On_Hold__c, ' +
                'Krowne_Ship_Date__c, Projected_Ship_Date__c ' +
                'FROM Order WHERE Void__c != \'1\'';

            /* 🔍 Search */
            if (String.isNotBlank(searchKey)) {
                query += ' AND (Account.Name LIKE :searchPattern ' +
                         'OR Order_Document_Number__c LIKE :searchPattern'+
                         'OR PoNumber LIKE :searchPattern ' +
                         'OR Project_Name__c LIKE :searchPattern)';
            }

            /* ⏸ On Hold Filter */
            if (fetchOnHoldOrders) {
                query += ' AND Order_On_Hold__c != null';
            }

            /* 📅 Day Range Filter */
            if (dayRange != null && dayRange > 0) {
                Date filterDate = Date.today().addDays(-dayRange);
                query += ' AND (Projected_Ship_Date__c = NULL ' +
                        'OR Projected_Ship_Date__c = 1900-01-01 ' +
                         'OR (Projected_Ship_Date__c >= :filterDate ' +
                         'AND Projected_Ship_Date__c <= TODAY))';
                        }

            /* 📦 Order Status Filter */
            if (orderFilterName != null) {
                if (orderFilterName == 'Shipped Orders') {
                    query += ' AND Tracking_Status__c = \'Shipped\'';
                } else if (orderFilterName == 'Open Orders') {
                    query += ' AND Tracking_Status__c != \'Shipped\'';
                }
            }

            /* 🔑 Stable ordering (MANDATORY for client pagination) */
            query += ' ORDER BY Projected_Ship_Date__c ASC, Id ASC';

            /* 🛑 Hard safety cap for client-side pagination */
            query += ' LIMIT 10000';

            List<Order> orderList = Database.query(query);

            for (Order ord : orderList) {
                Map<String, String> orderMap = new Map<String, String>{
                    'Id'               => ord.Id,
                    'Name'             => ord.Order_Document_Number__c,
                    'AccountName'      => ord.Account != null ? ord.Account.Name : '',
                    'AccountId'        => ord.AccountId,
                    'EffectiveDate'    => String.valueOf(ord.EffectiveDate),
                    'EndDate'          => String.valueOf(ord.EndDate),
                    'OwnerName'        => ord.Owner != null ? ord.Owner.Name : '',
                    'CreatedDate'      => String.valueOf(ord.CreatedDate),
                    'LastModifiedDate' => String.valueOf(ord.LastModifiedDate),
                    'ShipDate'         => ord.Projected_Ship_Date__c != null
                                          ? String.valueOf(ord.Projected_Ship_Date__c)
                                          : '1900-01-01',
                    'Type'             => 'Order',
                    'Status'           => ord.Tracking_Status__c,
                    'PoNumber'         => ord.PoNumber,
                    'Project'          => ord.Mark_4_Project__c,
                    'GPAmount'         => String.valueOf(ord.GP_Amount__c)
                };

                if (fetchOnHoldOrders) {
                    orderMap.put('onhold', String.valueOf(ord.Order_On_Hold__c));
                }

                orders.add(orderMap);
            }

            return orders;

        } catch (Exception e) {
            throw new AuraHandledException('Apex Error: ' + e.getMessage());
        }
    }



    @AuraEnabled
    public static List<Map<String, String>> getInvoices(String searchKey, Integer dayRange, Integer limitSize, Integer offset) {
        List<Map<String, String>> invoices = new List<Map<String, String>>();

        String searchPattern = '%' + (searchKey != null ? searchKey : '') + '%';

        String query = 'SELECT Id, ' +
        'Invoice_Document_Number__c, ' +
        'Account_Name__c, ' +
        'Customer_PO_Number__c, ' +
        'Order__c, ' +
        'Order__r.Order_Document_Number__c, ' +
        'Order__r.AccountId, ' +
        'CreatedDate ' +
        'FROM Invoice__c ';

            if (String.isNotBlank(searchKey)) {
                system.debug('searchkey is present===>'+ searchkey);
                offset = 0;
                query += ' WHERE (Account_Name__c LIKE :searchPattern ' +
                        'OR Order__r.Order_Document_Number__c LIKE :searchPattern ' +
                        'OR Invoice_Document_Number__c LIKE :searchPattern) ';
            } else {
                query += ' WHERE Id != null '; // dummy filter to start WHERE clause
        }

if (dayRange != null && dayRange > 0) {
    DateTime filterDateTime = DateTime.newInstance(Date.today().addDays(-dayRange), Time.newInstance(0, 0, 0, 0));
    query += ' AND CreatedDate >= :filterDateTime';
}

query += ' ORDER BY CreatedDate DESC LIMIT :limitSize OFFSET :offset';


            List<Invoice__c> InvoiceList = Database.query(query);

        // Query with LIKE filters
        // List<Invoice__c> invoiceList = [
        //     SELECT Id,
        //            Invoice_Document_Number__c,
        //            Account_Name__c,
        //            Order__c,
        //            Order__r.Order_Document_Number__c,
        //            Order__r.AccountId,
        //            CreatedDate
        //     FROM Invoice__c
        //     WHERE Account_Name__c LIKE :searchPattern
        //        OR Order__r.Order_Document_Number__c LIKE :searchPattern 
        //        OR Invoice_Document_Number__c LIKE :searchPattern
        //     LIMIT 100
        // ];

        for (Invoice__c inv : invoiceList) {
            invoices.add(new Map<String, String>{
                'Id'          => inv.Id,
                'Name'        => inv.Invoice_Document_Number__c,
                'AccountName' => inv.Account_Name__c,
                'AccountId'   => inv.Order__c != null ? inv.Order__r.AccountId : null,
                'OrderName'   => inv.Order__c != null ? inv.Order__r.Order_Document_Number__c : '',
                'CreatedDate' => String.valueOf(inv.CreatedDate),
                'Type'        => 'Invoice',
                'OrderId'      => inv.Order__c,
                'PONumber'      => inv.Customer_PO_Number__c
            });
        }
        system.debug('Invoices==>'+invoiceList);

        system.debug('Invoices==>'+invoices.size());

        return invoices;
    }

}