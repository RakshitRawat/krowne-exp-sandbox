public with sharing class OrderAndInvoiceListViewController {
    
    @AuraEnabled
    public static List<Map<String, String>> getOrders(String searchKey, Boolean fetchOnHoldOrders, Integer dayRange) {
    List<Map<String, String>> orders = new List<Map<String, String>>();
    System.debug('dayRange param: ' + dayRange);
    String searchPattern = '%' + (searchKey != null ? searchKey : '') + '%';

    String query = 'SELECT Id, PoNumber, Project_Name__c, OrderNumber, Account.Name, EffectiveDate, EndDate, ' +
                   'Owner.Name, CreatedDate, Status, LastModifiedDate, Order_Document_Number__c, Order_On_Hold__c, Krowne_Ship_Date__c ' +
                   'FROM Order WHERE (Account.Name LIKE :searchPattern OR Order_Document_Number__c LIKE :searchPattern)';

    if (fetchOnHoldOrders) {
        query += ' AND Order_On_Hold__c != null';
    }

    if (dayRange != null && dayRange > 0) {
    DateTime filterDateTime = DateTime.newInstance(Date.today().addDays(-dayRange), Time.newInstance(0, 0, 0, 0));
    System.debug(filterDateTime);
    query += ' AND CreatedDate >= :filterDateTime';
    }


    query += ' ORDER BY CreatedDate DESC LIMIT 500';
    System.debug('Query ==> '+query);

    List<Order> orderList = Database.query(query);

    for (Order ord : orderList) {
        Map<String, String> orderMap = new Map<String, String>{
            'Id'              => ord.Id,
            'Name'            => ord.Order_Document_Number__c,
            'AccountName'     => ord.Account != null ? ord.Account.Name : '',
            'AccountId'       => ord.AccountId,
            'EffectiveDate'   => String.valueOf(ord.EffectiveDate),
            'EndDate'         => String.valueOf(ord.EndDate),
            'OwnerName'       => ord.Owner != null ? ord.Owner.Name : '',
            'CreatedDate'     => String.valueOf(ord.CreatedDate),
            'LastModifiedDate'=> String.valueOf(ord.LastModifiedDate),
            'Type'            => 'Order',
            'Status'          => ord.Status,
            'PoNumber'        => ord.PoNumber,
            'Project'         => ord.Project_Name__c,
            'ShipDate'      => String.valueOf(ord.Krowne_Ship_Date__c)
        };
        if (fetchOnHoldOrders) {
            orderMap.put('onhold', ord.Order_On_Hold__c);
        }
        orders.add(orderMap);
    }
    system.debug('Orders==>'+orders.size());
    return orders;
    }


    @AuraEnabled
    public static List<Map<String, String>> getInvoices(String searchKey, Integer dayRange) {
        List<Map<String, String>> invoices = new List<Map<String, String>>();

        // Prepare wildcard pattern — blank key matches all
        String searchPattern = '%' + (searchKey != null ? searchKey : '') + '%';

        

            String query = 'SELECT Id, ' +
               'Invoice_Document_Number__c, ' +
               'Account_Name__c, ' +
               'Customer_PO_Number__c, ' +
               'Order__c, ' +
               'Order__r.Order_Document_Number__c, ' +
               'Order__r.AccountId, ' +
               'CreatedDate ' +
               'FROM Invoice__c ' +
               'WHERE (Account_Name__c LIKE :searchPattern ' +
               'OR Order__r.Order_Document_Number__c LIKE :searchPattern ' +
               'OR Invoice_Document_Number__c LIKE :searchPattern) ';

            if (dayRange != null && dayRange > 0) {
            DateTime filterDateTime = DateTime.newInstance(Date.today().addDays(-dayRange), Time.newInstance(0, 0, 0, 0));
            System.debug(filterDateTime);
            query += ' AND CreatedDate >= :filterDateTime';
            }

            query += ' LIMIT 500';

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

        return invoices;
    }

}