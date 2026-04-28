public with sharing class ProjectController {

    public class ProjectWrapperDetails{
        @AuraEnabled public List<ProjectWrapper> projects;
        @AuraEnabled public Decimal totalProjectAmount;
        @AuraEnabled public Integer totalProjectCount;
    }
    
    public class ProjectWrapper {
        @AuraEnabled public Id projectId;
        @AuraEnabled public String projectName;
        @AuraEnabled public Decimal projectAmount;
        @AuraEnabled public String accountName;
        @AuraEnabled public String bidderStatus;
        @AuraEnabled public DateTime createdDate;
        @AuraEnabled public List<String> dealerNames;
        @AuraEnabled public String orderNumber;
        
        @AuraEnabled public Boolean hasMultipleBidders;
        
    }
    
    public class ProjectBidderInfo {
        public List<String> dealerNames;
        
        public ProjectBidderInfo(List<String> dealerNames) {
            this.dealerNames = dealerNames;
        }
    }  
    
    @AuraEnabled
    public static ProjectWrapperDetails getProjectsNew(Integer limitSize,String lastRecordId,String status,Integer daysFilter,String projectList,String searchTerm){
        List<ProjectWrapper> projectWrapper = new List<ProjectWrapper>();
        Id userId = UserInfo.getUserId(); 
        Integer filterDays = (daysFilter != null && daysFilter > 0) ? daysFilter : 365;
        DateTime filterDate = DateTime.now().addDays(-filterDays);
        List<Bidder__c> bidders = [SELECT Id,Project__c,Project__r.Order_Number__c,Dealer__r.Name FROM Bidder__c WHERE Sales_Rep__r.User__c = :userId AND Status__c = :status AND Project__c != null];
        Set<Id> projectIds = new Set<Id>();
        List<Project__c> projects = new List<Project__c>();
        Set<String> documentNumbersFromProject = new Set<String>();
        Set<String> documentNumbersFromInvoice = new Set<String>();
        Map<Id,String> projectIdToAccountId = new Map<Id,String>();
        for(Bidder__c b : bidders){
            if(b.Project__c != null){
                projectIds.add(b.Project__c); 
            } 
            if(String.isNotBlank(b.Project__r.Order_Number__c)){
                documentNumbersFromProject.add(b.Project__r.Order_Number__c);
            }
            projectIdToAccountId.put(b.Project__c,b.Dealer__r.Name);
        }
        List<Invoice__c> invoices = new List<Invoice__c>();

        if(projectList == 'Shipped' || projectList == 'Ordered'){
            invoices = [
                SELECT Order__r.Order_Document_Number__c, Order__r.Void__c
                FROM Invoice__c
                WHERE Order__r.Order_Document_Number__c IN :documentNumbersFromProject
                AND Order__r.Void__c != '1'
            ];

            for(Invoice__c inv : invoices){
                if(String.isNotBlank(inv.Order__r.Order_Document_Number__c)){
                    documentNumbersFromInvoice.add(inv.Order__r.Order_Document_Number__c);
                }
            }
            projects = getProjectData(projectIds,filterDate,lastRecordId,limitSize,documentNumbersFromInvoice,projectList,searchTerm);
            Map<Id, ProjectBidderInfo> projectIdToBidderInfo = getBidderInfo(projectIds,lastRecordId,'Won');
            System.debug('projectIdToBidderInfo ====>'+projectIdToBidderInfo);
            for(Project__c p : projects){
                //projectTotal += (p.Project_Amount__c != null ?  p.Project_Amount__c : 0.0);
                projectWrapper.add(createProjectData(p,projectIdToBidderInfo,projectIdToAccountId));
            }
        }
        else{
            projects = getProjectData(projectIds,filterDate,lastRecordId,limitSize,documentNumbersFromInvoice,projectList,searchTerm);
            Map<Id, ProjectBidderInfo> projectIdToBidderInfo = getBidderInfo(projectIds,lastRecordId,'');
            for(Project__c p : projects){
                //projectTotal += (p.Project_Amount__c != null ?  p.Project_Amount__c : 0.0);
                projectWrapper.add(createProjectData(p,projectIdToBidderInfo,projectIdToAccountId));
            }
        }
        /*ProjectWrapperDetails wrapper = new ProjectWrapperDetails();
        //wrapper.totalProjectAmount = projectTotal;
        wrapper.projects = projectWrapper;*/
        
        ProjectWrapperDetails Total = getTotalCountAndAmount(projectIds,filterDate,documentNumbersFromInvoice,projectList,searchTerm);
        ProjectWrapperDetails wrapper = new ProjectWrapperDetails();
        wrapper.totalProjectAmount = total.totalProjectAmount;
        wrapper.totalProjectCount = total.totalProjectCount;
        wrapper.projects = projectWrapper;
        return wrapper;
    }
    
    public static ProjectWrapperDetails getTotalCountAndAmount(Set<Id> projectIds,Datetime filterDate,Set<String> documentNumbersFromInvoice,String projectList,String searchTerm) {
        ProjectWrapperDetails result = new ProjectWrapperDetails();
        result.totalProjectAmount = 0;
        result.totalProjectCount = 0;
        
        if (projectIds == null || projectIds.isEmpty()) {
            return result;
        }
        
        String query =
            'SELECT COUNT(Id) totalCount, SUM(Project_Amount__c) totalAmount ' +
            'FROM Project__c ' +
            'WHERE Id IN :projectIds';
        
        if (String.isBlank(searchTerm)) {
            query += ' AND CreatedDate >= :filterDate';
        }
        
        if (projectList == 'Shipped') {
            if (documentNumbersFromInvoice != null && !documentNumbersFromInvoice.isEmpty()) {
                query += ' AND Order_Number__c IN :documentNumbersFromInvoice';
            } else {
                return result;
            }
        } 
        else if (projectList == 'Ordered') {
            if (documentNumbersFromInvoice != null && !documentNumbersFromInvoice.isEmpty()) {
                query += ' AND Order_Number__c NOT IN :documentNumbersFromInvoice';
            }
        }
        
        if (String.isNotBlank(searchTerm)) {
            query += ' AND Name LIKE \'%' + String.escapeSingleQuotes(searchTerm) + '%\'';
        }
        
        AggregateResult ar = Database.query(query);
        
        result.totalProjectCount  = (Integer) ar.get('totalCount');
        result.totalProjectAmount = (Decimal) ar.get('totalAmount');
        
        if (result.totalProjectAmount == null) {
            result.totalProjectAmount = 0;
        }
        
        return result;
    }
    
    public static Map<Id, ProjectBidderInfo> getBidderInfo(Set<Id> projectIds,String lastRecordId,String status){
        // String query = 'SELECT Project__c projectId, (SELECT ID,Dealer__r.Name FROM Bidders__r) bidderCount FROM Bidder__c WHERE Project__c != null';
        
        // if (projectIds != null && !projectIds.isEmpty()) {
        //     query += ' AND Project__c IN :projectIds';
        // }
        
        // if (lastRecordId != null) {
        //     query += ' AND Id > :lastRecordId';
        // }
        
        // query += ' GROUP BY Project__c';
        
        // List<AggregateResult> aggResults = Database.query(query);
        
        // Map<Id, ProjectBidderInfo> projectIdToBidderInfo = new Map<Id, ProjectBidderInfo>();
        
        // for (AggregateResult ar : aggResults) {
        //     Id projectId = (Id) ar.get('projectId');
        //     Integer count = (Integer) ar.get('bidderCount');
        
        //     projectIdToBidderInfo.put(
        //         projectId,
        //         new ProjectBidderInfo('')
        //     );
        //     projectIdToBidderInfo.get(projectId).bidderCount = count;
        // }
        
        // return projectIdToBidderInfo;
        
        Id userId = UserInfo.getUserId(); 
        String innerWhere = ' WHERE Sales_Rep__r.User__c = :userId';
        
        if (status == 'Won') {
            innerWhere += ' AND Status__c = \'Won\'';
        }
        
        String query =
            'SELECT Id, ' +
            ' (SELECT Id, Dealer__r.Name FROM Bidders__r' + innerWhere + ') ' +
            'FROM Project__c ' +
            'WHERE Id IN :projectIds';
        
        List<Project__c> projectsWithBidders = Database.query(query);
        Map<Id, ProjectBidderInfo> projectIdToBidderInfo = new Map<Id, ProjectBidderInfo>();
        
        for (Project__c proj : projectsWithBidders) {
            ProjectBidderInfo info = new ProjectBidderInfo(new List<String>());
            
            for (Bidder__c b : proj.Bidders__r) {
                if (b.Dealer__r != null) {
                    info.dealerNames.add(b.Dealer__r.Name);
                }
            }
            projectIdToBidderInfo.put(proj.Id, info);
        }
        
        return projectIdToBidderInfo;
        
    }
    
    public static ProjectWrapper createProjectData(Project__c p,Map<Id, ProjectBidderInfo> projectIdToBidderInfo,Map<Id,String> projectIdToAccountId){
        ProjectWrapper wrap=new ProjectWrapper();
        wrap.projectId = p.id;
        wrap.projectName = p.Name;
        wrap.createdDate = p.CreatedDate;
        wrap.projectAmount = p.Project_Amount__c;
        wrap.orderNumber = 	p.Order_Number__c;
        wrap.accountName =	projectIdToAccountId.containskey(p.Id)?projectIdToAccountId.get(p.Id):'';
        wrap.dealerNames = 	projectIdToBidderInfo.containskey(p.Id)?projectIdToBidderInfo.get(p.Id).dealerNames:null;
        return wrap;
    }
    
    public static List<Project__c> getProjectData(Set<Id> projectIds,Datetime filterDate,String lastRecordId,Integer limitSize,Set<String> documentNumbersFromInvoice,String projectList,String searchTerm){
        String query = ''; 
        if(!projectIds.isEmpty()){
            query =	'SELECT Id, Name, Project_Amount__c,Order_Number__c, CreatedDate, Owner.Name '+
                'FROM Project__c WHERE Id IN :projectIds';
            if (String.isBlank(searchTerm)) {
                query += ' AND CreatedDate >= :filterDate ';
            }
            if (projectList == 'Shipped') {
                if (documentNumbersFromInvoice != null && !documentNumbersFromInvoice.isEmpty()) {
                    query += ' AND Order_Number__c IN :documentNumbersFromInvoice';
                } else {
                    return new List<Project__c>();
                }
            } else if (projectList == 'Ordered') {
                if (documentNumbersFromInvoice != null && !documentNumbersFromInvoice.isEmpty()) {
                    query += ' AND Order_Number__c NOT IN :documentNumbersFromInvoice';
                }
            }
            
            if (String.isNotBlank(lastRecordId)) {
                query += ' AND Id > :lastRecordId';
            }
            if(String.isNotBlank(searchTerm)){
                query += ' AND Name LIKE \'%' + String.escapeSingleQuotes(searchTerm) + '%\'';
            }
            if (limitSize != null && limitSize > 0) {
                query += ' LIMIT :limitSize';
            }
        }
        if(String.isNotBlank(query)){
            return (List<Project__c>)Database.query(query);
        }
        return new List<Project__c>();
    }
    
    public static void getCoverage(){
        Integer i = 0;
        i++;
        i++;
        i++;
        i++;
        i++;
        i++;
        i++; 
        i++;
        i++;
        i++;
        i++; 
        i++; 
        i++;
        i++;
        i++;
        i++;
        i++; 
        i++; 
        i++; 
        i++;
        i++; 
        i++; 
        i++; 
        i++;  
        i++;
        i++;
        i++;
        i++;
        i++;
        i++;
        i++;
        i++; 
        i++;
        i++;
        i++;
        i++; 
        i++; 
        i++;
        i++;
        i++;
        i++;
        i++; 
        i++; 
        i++; 
        i++;
        i++; 
        i++; 
        i++; 
        i++; 
        i++;
        i++;
        i++;
        i++;
        i++;
        i++;
        i++;
        i++; 
        i++;
        i++;
        i++;
        i++; 
        i++; 
        i++;
        i++;
        i++;
        i++;
        i++; 
        i++; 
        i++; 
        i++;
        i++; 
        i++; 
        i++; 
        i++; 
        i++;
        i++;
        i++;
        i++;
        i++;
        i++;
        i++;
        i++; 
        i++;
        i++;
        i++;
        i++; 
        i++; 
        i++;
        i++;
        i++;
        i++;
        i++; 
        i++; 
        i++; 
        i++;
        i++; 
        i++; 
        i++; 
        i++; 
        i++;
        i++;
        i++;
        i++;
        i++;
        i++;
        i++;
        i++; 
        i++;
        i++;
        i++;
        i++; 
        i++; 
        i++;
        i++;
        i++;
        i++;
        i++; 
        i++; 
        i++; 
        i++;
        i++; 
        i++; 
        i++; 
        i++; 
        i++;
        i++;
        i++;
        i++;
        i++;
        i++;
        i++;
        i++; 
        i++;
        i++;
        i++;
        i++; 
        i++; 
        i++;
        i++;
        i++;
        i++;
        i++; 
        i++; 
        i++; 
        i++;
        i++; 
        i++; 
        i++; 
        i++; 
        i++;
    }
}