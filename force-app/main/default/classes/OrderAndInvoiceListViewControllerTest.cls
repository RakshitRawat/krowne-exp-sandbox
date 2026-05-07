@isTest
private class OrderAndInvoiceListViewControllerTest {

    @testSetup
    static void setupTestData() {
        // Create a test Account
        Account acc = new Account(Name = 'Test Account');
        insert acc;


        // Create Orders
        List<Order> orders = new List<Order>{
            new Order(
                AccountId = acc.Id,
                Status = 'In the Works',
                EffectiveDate = Date.today(),
                EndDate = Date.today().addDays(30),
                Order_Document_Number__c = 'DOC-001',
                Batch_Q__c = 'Pick'
            ),
            new Order(
                AccountId = acc.Id,
                Status = 'In the Works',
                EffectiveDate = Date.today().addDays(-10),
                EndDate = Date.today().addDays(20),
                Order_Document_Number__c = 'DOC-002',
                Batch_Q__c = 'Invoice',
                Projected_Ship_Date__c = Date.today()
            )
        };
        insert orders;
        
        System.debug([SELECT ID,Tracking_Status__c FROM Order]);
        // Create Invoice
        Invoice__c inv = new Invoice__c(
            Invoice_Document_Number__c = 'INV-001',
            Order__c = orders[0].Id
        );
        insert inv;
    }

    @isTest
    static void testGetOrdersWithSearchAndOnHold() {
        Test.startTest();
        //List<Map<String, String>> result = OrderAndInvoiceListViewController.getOrders('Test', true, 30, 10, 10,'Shipped Orders');
        List<Map<String, String>> result = OrderAndInvoiceListViewController.getOrders('Test', true, 30, 10, 'Shipped Orders',null ,null);
        Test.stopTest();

        Boolean hasOnHold = false;
        for (Map<String, String> order : result) {
            if (order.containsKey('onhold')) {
                hasOnHold = true;
                break;
            }
        }
    }

    @isTest
    static void testGetOrdersWithoutOnHold() {
        Test.startTest();
        //List<Map<String, String>> result = OrderAndInvoiceListViewController.getOrders('', false, 30, 10, 0,'Shipped Orders');
        List<Map<String, String>> result = OrderAndInvoiceListViewController.getOrders('', false, 30, 10,'Shipped Orders', null, null);
        Test.stopTest();
    }

    @isTest
    static void testGetInvoices() {
        Test.startTest();
        List<Map<String, String>> result = OrderAndInvoiceListViewController.getInvoices('INV', 30, 10, 10);
        Test.stopTest();
    }
}