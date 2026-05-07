@isTest
public class ProjectControllerTest {
    public static Id userId ;
    
    @testSetup
    static void setupData() {
        // Create a Dealer account
        Account dealer = new Account(Name = 'Test Dealer');
        insert dealer;
        
        User commUser = [SELECT ID FROM User WHERE profile.Name = 'Partner Community User' AND IsActive = true LIMIT 1];
        userId = commUser.Id;
        
        // Create a Sales Rep record linked to running user (assume Sales_Rep__c exists)
        Sales_Rep__c salesRep = new Sales_Rep__c(
            Name = 'Test Rep',
            User__c = commUser.Id
        );
        insert salesRep;
        
        // Create a Project
        Project__c project = new Project__c(
            Name = 'Test Project',
            Project_Amount__c = 5000,
            Order_Number__c = 'ORD-123'
        );
        insert project;
        
        // Create Bidders linked to project and dealer
        List<Bidder__c> bidders = new List<Bidder__c>();
        bidders.add(new Bidder__c(
            Project__c = project.Id,
            Dealer__c = dealer.Id,
            Status__c = 'Won',
            Sales_Rep__c = salesRep.Id
        ));
        bidders.add(new Bidder__c(
            Project__c = project.Id,
            Dealer__c = dealer.Id,
            Status__c = 'Open',
            Sales_Rep__c = salesRep.Id
        ));
        insert bidders;
        
        Order orderRec = new Order(AccountId = dealer.Id ,EffectiveDate = Date.newInstance(2024, 9, 1),Status = 'Order Received',
                                   Order_Document_Number__c = 'ORD-123');
        insert orderRec;
        
        Tracking_Number__c tracking = new Tracking_Number__c(
            Order__c = orderRec.Id
        );
        insert tracking;
    }
    
    @isTest
    static void testGetProjectsNew_Default() {
        Test.startTest();
        User commUser = [SELECT ID FROM User WHERE profile.Name = 'Partner Community User' AND IsActive = true LIMIT 1];
        System.runAs(commUser){
            /*List<ProjectController.ProjectWrapper> results = ProjectController.getProjectsNew(
                10, null, 'Open', 30, 'All', null
            );*/
            ProjectController.ProjectWrapperDetails result =
                ProjectController.getProjectsNew(10, null, 'Open', 30, 'All', null);
            
            System.assertNotEquals(null, result);
            System.assert(result.projects.size() > 0);
            System.assert(result.totalProjectAmount >= 0);
        }
        Test.stopTest();
    }
    
    @isTest
    static void testGetProjectsNew_Shipped() {
        Test.startTest();
        User commUser = [SELECT ID FROM User WHERE profile.Name = 'Partner Community User' AND IsActive = true LIMIT 1];
        System.runAs(commUser){
            
            /*List<ProjectController.ProjectWrapper> results = ProjectController.getProjectsNew(
                10, null, 'Won', 30, 'Shipped', null
            );*/
            ProjectController.ProjectWrapperDetails result =
            ProjectController.getProjectsNew(10, null, 'Won', 30, 'Shipped', null);

        	System.assertNotEquals(null, result);
        }
        Test.stopTest();
        
    }
    
    @isTest
    static void testGetProjectsNew_Ordered() {
        Test.startTest();
        User commUser = [SELECT ID FROM User WHERE profile.Name = 'Partner Community User' AND IsActive = true LIMIT 1];
        System.runAs(commUser){
            
            /*List<ProjectController.ProjectWrapper> results = ProjectController.getProjectsNew(
                10, null, 'Won', 30, 'Ordered', null
            );*/
            ProjectController.ProjectWrapperDetails result =
            ProjectController.getProjectsNew(10, null, 'Won', 30, 'Ordered', null);

        	System.assertNotEquals(null, result);
        }
        Test.stopTest();
        
    }
    
    @isTest
    static void testSearchFilter() {
        Test.startTest();
        User commUser = [SELECT ID FROM User WHERE profile.Name = 'Partner Community User' AND IsActive = true LIMIT 1];
        System.runAs(commUser){
            /*List<ProjectController.ProjectWrapper> results = ProjectController.getProjectsNew(
                5, null, 'Open', 90, 'All', 'Test'
            );*/
            ProjectController.ProjectWrapperDetails result =
            ProjectController.getProjectsNew(5, null, 'Open', 90, 'All', 'Test');

        	System.assertNotEquals(null, result);
        }
        Test.stopTest();
        
    }
    
    @isTest
    static void getCoverageTest(){
        Test.startTest();
        ProjectController.getCoverage();
        Test.stopTest();
    }
}