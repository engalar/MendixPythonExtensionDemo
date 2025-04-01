import json
from typing import Any, Dict, List

import clr
clr.AddReference("Mendix.StudioPro.ExtensionsAPI")
from Mendix.StudioPro.ExtensionsAPI.Model.UntypedModel import PropertyType
clr.AddReference("Mendix.StudioPro.ExtensionsAPI")
from Mendix.StudioPro.ExtensionsAPI.Model.Microflows import IMicroflow
from Mendix.StudioPro.ExtensionsAPI.Model.Pages import IPage

#ShowDevTools()

def serialize_json_object(json_object: Any) -> str:
    import System.Text.Json
    return System.Text.Json.JsonSerializer.Serialize(json_object)

def deserialize_json_string(json_string: str) -> Any:
    return json.loads(json_string)

def post_message(channel: str, message: str):
    PostMessage(channel, message)
    
#---
class ElementRetriever:
    def __init__(self, root):
        self.root = root

    def get_modules(self):
        return self.root.GetUnitsOfType("Projects$Module")

    def get_elements(self, unit_type: str):
        elements = []
        modules = self.get_modules()
        if unit_type == "Projects$Module":
            for module in modules:
                elements.append({
                    "id": str(module.ID),
                    "name": f"{module.Name}",
                    "type": unit_type.split("$")[-1]  # Extracts the type name
                })
            return elements
        for module in modules:
            module_name = module.Name
            units = module.GetUnitsOfType(unit_type)
            for unit in units:
                elements.append({
                    "id": str(unit.ID),
                    "name": f"{module_name}.{unit.Name}",
                    "type": unit_type.split("$")[-1],
                    "qualifiedName": unit.QualifiedName if hasattr(unit, "QualifiedName") else None  # Use QualifiedName attribute
                })
        return elements

    def get_domain_model_elements(self):
        elements = []
        modules = self.get_modules()
        for module in modules:
            module_name = module.Name
            domain_models = module.GetUnitsOfType("DomainModels$DomainModel")
            for dm in domain_models:
                elements.append({
                    "id": str(dm.ID),
                    "name": f"{module_name}.{dm.Name}",
                    "type": "DomainModel"
                })
                entities = dm.GetElementsOfType("DomainModels$Entity")
                for entity in entities:
                    elements.append({
                        "id": str(entity.ID),
                        "name": f"{module_name}.{entity.Name}",
                        "type": "Entity"
                    })
        return elements

    def get_element_by_id_and_type(self, element_id: str, element_type: str):
        unit_type_map = {
            "Module": "Projects$Module",
            "DomainModel": "DomainModels$DomainModel",
            "Microflow": "Microflows$Microflow",
            "Page": "Pages$Page",
            "Entity": "DomainModels$Entity"
        }
        unit_type = unit_type_map.get(element_type)
        if not unit_type:
            return None

        if element_type == "Entity":
            modules = self.get_modules()
            for module in modules:
                domain_models = module.GetUnitsOfType("DomainModels$DomainModel")
                for dm in domain_models:
                    entities = dm.GetElementsOfType("DomainModels$Entity")
                    for entity in entities:
                        if str(entity.ID) == element_id:
                            return entity
            return None
            
        units = self.root.GetUnitsOfType(unit_type)
        for unit in units:
            if str(unit.ID) == element_id:
                return unit
        return None
#---
def extract_element_details(element) -> Dict[str, Any]:
    details = {
        "name": element.Name,
        "type": element.Type,
        "properties": [],
        "children": [],
        "qualifiedName": element.QualifiedName# if hasattr(element, "QualifiedName") else None # Use QualifiedName attribute
    }
    for prop in element.GetProperties():
        prop_details = {
            "name": prop.Name,
            "type": str(prop.Type),
            "value": str(prop.Value) if prop.Value is not None else "N/A"
        }
        if prop.Type == PropertyType.Element:
            if prop.IsList:
                prop_details["value"] = f"[{len(list(prop.Value))} elements]" if prop.Value else "[]"
            else:
                prop_details["value"] = str(prop.Value.Name) if prop.Value else "N/A"
        details["properties"].append(prop_details)
    for child in element.GetElements():
        details["children"].append({
            "name": child.Name if hasattr(child, "Name") else "Unnamed",
            "type": child.Type
        })
    return details

# RPC处理器
class RpcHandler:
    def __init__(self, root):
        self.element_retriever = ElementRetriever(root)
        self.methods = {
            'getAllElements': self.get_all_elements,
            'getDomainModels': self.get_domain_models,
            'getMicroflows': self.get_microflows,
            'getPages': self.get_pages,
            'getElementDetails': self.get_element_details,
            'locateElement': self.locate_element
        }
    
    def handle_request(self, request):
        method = request.get('method')
        params = request.get('params', {})
        request_id = request.get('id')
        
        if method not in self.methods:
            return {
                'jsonrpc': '2.0',
                'error': f'Method "{method}" not found',
                'id': request_id
            }
        
        try:
            result = self.methods[method](**params)
            return {
                'jsonrpc': '2.0',
                'result': result,
                'requestId': request_id
            }
        except Exception as e:
            return {
                'jsonrpc': '2.0',
                'error': str(e),
                'requestId': request_id
            }
    
    def get_all_elements(self):
        return self.element_retriever.get_elements("Projects$Module")
    
    def get_domain_models(self):
        return self.element_retriever.get_domain_model_elements()
    
    def get_microflows(self):
        microflows = self.element_retriever.get_elements("Microflows$Microflow")
        return microflows
    
    def get_pages(self):
        pages = self.element_retriever.get_elements("Pages$Page")
        return pages
    
    def get_element_details(self, elementId, elementType):
        element = self.element_retriever.get_element_by_id_and_type(elementId, elementType)
        if element:
            return extract_element_details(element)
        else:
            raise Exception(f"Element with ID {elementId} and type {elementType} not found")

    def locate_element(self, qualifiedName, elementType):
        print(f"Open element called for {qualifiedName} of type {elementType}")
        
        unit_type_map = {
            "Microflows$Microflow": IMicroflow,
            "Pages$Page": IPage
        }
        
        element_type_api = unit_type_map.get(elementType)
                
        if element_type_api is None:
            raise Exception(f"Unsupported element type: {elementType}")

        method = currentApp.ToQualifiedName[element_type_api]
        element_qname = method(qualifiedName)#type is IQualifiedName
        element = element_qname.Resolve()#type is IMicroflow

        if element is None:
             raise Exception(f"element is not found")
        TryOpenEditor(element)
        return {"success": True, "message": f"Open element called for {qualifiedName}"}

# 创建RPC处理器实例
rpc_handler = RpcHandler(root)

def serialize_json_object(json_object: Any) -> str:
    import System.Text.Json
    return System.Text.Json.JsonSerializer.Serialize(json_object)

def deserialize_json_string(json_string: str) -> Any:
    return json.loads(json_string)

def post_message(channel: str, message: str):
    PostMessage(channel, message)

def onMessage(e):
    message_data = deserialize_json_string(serialize_json_object(e))
    if e.Message == "frontend:message":
        data = message_data["Data"]
        response = rpc_handler.handle_request(data)
        post_message("backend:response", json.dumps(response))

